use anyhow::Result;
use bytes::BytesMut;
use prost::Message;
use tokio_util::codec::{Decoder, Encoder};

pub mod mumble_proto {
    include!(concat!(env!("OUT_DIR"), "/mumble_proto.rs"));
}
pub use mumble_proto::*;

include!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../proto/mumble_codec_shared.rs"
));
