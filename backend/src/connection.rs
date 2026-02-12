use crate::codec::{MumbleCodec, MumblePacket};
use anyhow::Result;
use futures::{SinkExt, StreamExt};
use std::net::SocketAddr;
use tokio::net::TcpStream;
use tokio_rustls::server::TlsStream;
use tokio_util::codec::Framed;

pub struct Connection {
    framed: Framed<TlsStream<TcpStream>, MumbleCodec>,
    peer_addr: SocketAddr,
}

impl Connection {
    pub fn new(stream: TlsStream<TcpStream>, peer_addr: SocketAddr) -> Self {
        Self {
            framed: Framed::new(stream, MumbleCodec),
            peer_addr,
        }
    }

    pub async fn read_packet(&mut self) -> Result<Option<MumblePacket>> {
        match self.framed.next().await {
            Some(Ok(packet)) => Ok(Some(packet)),
            Some(Err(e)) => Err(anyhow::anyhow!("Connection error: {}", e)),
            None => Ok(None),
        }
    }

    pub async fn write_packet(&mut self, packet: MumblePacket) -> Result<()> {
        self.framed.send(packet).await.map_err(|e| anyhow::anyhow!("Send error: {}", e))
    }

    pub fn peer_addr(&self) -> SocketAddr {
        self.peer_addr
    }
}
