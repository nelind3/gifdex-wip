use crate::{AppState, MAX_BLOB_SIZE};
use axum::{
    body::{Body, Bytes},
    extract::{Path, State},
    http::{Response, StatusCode},
    response::IntoResponse,
};
use floodgate::extern_types::{cid::Cid, did::Did, tid::Tid};
use futures::StreamExt;
use sqlx::query;
use std::sync::Arc;
use tracing::warn;

pub async fn get_gif_handler(
    Path((did, rkey)): Path<(String, String)>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Parse DID
    let did = match Did::new(&did) {
        Ok(did) => did,
        Err(err) => {
            warn!("invalid DID '{did}': {err:?}");
            return StatusCode::BAD_REQUEST.into_response();
        }
    };

    // Parse rkey (format: tid:cid)
    let (tid_str, cid_str) = match rkey.split_once(':') {
        Some(parts) => parts,
        None => {
            warn!("malformed rkey (expected tid:cid format)");
            return StatusCode::BAD_REQUEST.into_response();
        }
    };

    let _tid = match Tid::new(tid_str) {
        Ok(tid) => tid,
        Err(err) => {
            warn!("invalid TID in rkey: {err:?}");
            return StatusCode::BAD_REQUEST.into_response();
        }
    };

    let _cid = match Cid::new(cid_str.as_bytes()) {
        Ok(cid) => cid,
        Err(err) => {
            warn!("invalid CID in rkey: {err:?}");
            return StatusCode::BAD_REQUEST.into_response();
        }
    };

    // Fetch blob CID from database
    let blob_cid = match query!(
        "SELECT blob_cid FROM posts WHERE did = $1 AND rkey = $2",
        did.as_str(),
        rkey
    )
    .fetch_optional(state.database.executor())
    .await
    {
        Ok(Some(record)) => record.blob_cid,
        Ok(None) => return StatusCode::NOT_FOUND.into_response(),
        Err(err) => {
            warn!("database error: {err:?}");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    // Resolve PDS endpoint
    let pds_url = match state.tap_client.resolve_did(&did).await {
        Ok(doc) => match doc.pds_endpoint() {
            Some(url) => url,
            None => {
                warn!("no PDS endpoint found for {did}");
                return StatusCode::BAD_GATEWAY.into_response();
            }
        },
        Err(err) => {
            warn!("failed to resolve DID {did}: {err:?}");
            return StatusCode::BAD_GATEWAY.into_response();
        }
    };

    // Build XRPC URL
    let mut xrpc_url = match pds_url.join("/xrpc/com.atproto.sync.getBlob") {
        Ok(url) => url,
        Err(err) => {
            warn!("failed to build XRPC URL: {err:?}");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };
    xrpc_url.set_query(Some(&format!("did={did}&cid={blob_cid}")));

    // Fetch blob from PDS
    let response = match state.http_client.get(xrpc_url).send().await {
        Ok(resp) => resp,
        Err(err) => {
            warn!("failed to fetch blob from PDS: {err:?}");
            return StatusCode::BAD_GATEWAY.into_response();
        }
    };

    if !response.status().is_success() {
        warn!("PDS returned error status: {}", response.status());
        return StatusCode::BAD_GATEWAY.into_response();
    }

    let pds_host = pds_url.host_str().unwrap_or("unknown");

    // Stream the response with size limit
    let bytes = {
        let mut buffer = Vec::with_capacity(
            response
                .content_length()
                .map(|len| len.min(MAX_BLOB_SIZE as u64) as usize)
                .unwrap_or(0),
        );
        let mut stream = response.bytes_stream();
        while let Some(chunk_result) = stream.next().await {
            let chunk = match chunk_result {
                Ok(chunk) => chunk,
                Err(err) => {
                    warn!("error reading blob stream: {err:?}");
                    return StatusCode::BAD_GATEWAY.into_response();
                }
            };

            if buffer.len() + chunk.len() > MAX_BLOB_SIZE {
                warn!("blob exceeds 10MB limit");
                return StatusCode::PAYLOAD_TOO_LARGE.into_response();
            }

            buffer.extend_from_slice(&chunk);
        }
        Bytes::from(buffer)
    };

    if !matches!(infer::get(&bytes).map(|t| t.mime_type()), Some("image/gif")) {
        warn!("blob is not a valid GIF");
        return StatusCode::UNPROCESSABLE_ENTITY.into_response();
    }

    let body = Body::from(bytes);

    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "image/gif")
        .header("Content-Security-Policy", "default-src 'none'; sandbox")
        .header("X-Content-Type-Options", "nosniff")
        .header("Cache-Control", "public, max-age=604800")
        .header("Upstream-Pds", pds_host)
        .body(body)
        .unwrap()
        .into_response()
}
