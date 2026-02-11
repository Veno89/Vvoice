pub struct MumbleCodec;

impl Decoder for MumbleCodec {
    type Item = MumblePacket;
    type Error = anyhow::Error;

    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        if src.len() < 6 {
            return Ok(None);
        }

        let packet_type = u16::from_be_bytes([src[0], src[1]]);
        let length = u32::from_be_bytes([src[2], src[3], src[4], src[5]]) as usize;

        if src.len() < 6 + length {
            src.reserve(6 + length - src.len());
            return Ok(None);
        }

        let _header = src.split_to(6);
        let payload = src.split_to(length);

        let packet = match packet_type {
            0 => MumblePacket::Version(Version::decode(payload)?),
            1 => MumblePacket::UDPTunnel(UdpTunnel {
                packet: payload.to_vec(),
            }),
            2 => MumblePacket::Authenticate(Authenticate::decode(payload)?),
            3 => MumblePacket::Ping(Ping::decode(payload)?),
            4 => MumblePacket::Reject(Reject::decode(payload)?),
            5 => MumblePacket::ServerSync(ServerSync::decode(payload)?),
            6 => MumblePacket::ChannelRemove(ChannelRemove::decode(payload)?),
            7 => MumblePacket::ChannelState(ChannelState::decode(payload)?),
            8 => MumblePacket::UserRemove(UserRemove::decode(payload)?),
            9 => MumblePacket::UserState(UserState::decode(payload)?),
            10 => MumblePacket::BanList(BanList::decode(payload)?),
            11 => MumblePacket::TextMessage(TextMessage::decode(payload)?),
            12 => MumblePacket::PermissionDenied(PermissionDenied::decode(payload)?),
            13 => MumblePacket::ACL(Acl::decode(payload)?),
            14 => MumblePacket::QueryUsers(QueryUsers::decode(payload)?),
            15 => MumblePacket::CryptSetup(CryptSetup::decode(payload)?),
            16 => MumblePacket::ContextActionModify(ContextActionModify::decode(payload)?),
            17 => MumblePacket::ContextAction(ContextAction::decode(payload)?),
            18 => MumblePacket::UserList(UserList::decode(payload)?),
            19 => MumblePacket::VoiceTarget(VoiceTarget::decode(payload)?),
            20 => MumblePacket::PermissionQuery(PermissionQuery::decode(payload)?),
            21 => MumblePacket::CodecVersion(CodecVersion::decode(payload)?),
            22 => MumblePacket::UserStats(UserStats::decode(payload)?),
            23 => MumblePacket::RequestBlob(RequestBlob::decode(payload)?),
            24 => MumblePacket::ServerConfig(ServerConfig::decode(payload)?),
            25 => MumblePacket::SuggestConfig(SuggestConfig::decode(payload)?),
            _ => return Ok(None),
        };

        Ok(Some(packet))
    }
}

impl Encoder<MumblePacket> for MumbleCodec {
    type Error = anyhow::Error;

    fn encode(&mut self, item: MumblePacket, dst: &mut BytesMut) -> Result<(), Self::Error> {
        let (packet_type, payload) = match item {
            MumblePacket::Version(msg) => (0u16, msg.encode_to_vec()),
            MumblePacket::UDPTunnel(msg) => (1, msg.packet),
            MumblePacket::Authenticate(msg) => (2, msg.encode_to_vec()),
            MumblePacket::Ping(msg) => (3, msg.encode_to_vec()),
            MumblePacket::Reject(msg) => (4, msg.encode_to_vec()),
            MumblePacket::ServerSync(msg) => (5, msg.encode_to_vec()),
            MumblePacket::ChannelRemove(msg) => (6, msg.encode_to_vec()),
            MumblePacket::ChannelState(msg) => (7, msg.encode_to_vec()),
            MumblePacket::UserRemove(msg) => (8, msg.encode_to_vec()),
            MumblePacket::UserState(msg) => (9, msg.encode_to_vec()),
            MumblePacket::BanList(msg) => (10, msg.encode_to_vec()),
            MumblePacket::TextMessage(msg) => (11, msg.encode_to_vec()),
            MumblePacket::PermissionDenied(msg) => (12, msg.encode_to_vec()),
            MumblePacket::ACL(msg) => (13, msg.encode_to_vec()),
            MumblePacket::QueryUsers(msg) => (14, msg.encode_to_vec()),
            MumblePacket::CryptSetup(msg) => (15, msg.encode_to_vec()),
            MumblePacket::ContextActionModify(msg) => (16, msg.encode_to_vec()),
            MumblePacket::ContextAction(msg) => (17, msg.encode_to_vec()),
            MumblePacket::UserList(msg) => (18, msg.encode_to_vec()),
            MumblePacket::VoiceTarget(msg) => (19, msg.encode_to_vec()),
            MumblePacket::PermissionQuery(msg) => (20, msg.encode_to_vec()),
            MumblePacket::CodecVersion(msg) => (21, msg.encode_to_vec()),
            MumblePacket::UserStats(msg) => (22, msg.encode_to_vec()),
            MumblePacket::RequestBlob(msg) => (23, msg.encode_to_vec()),
            MumblePacket::ServerConfig(msg) => (24, msg.encode_to_vec()),
            MumblePacket::SuggestConfig(msg) => (25, msg.encode_to_vec()),
        };

        dst.reserve(6 + payload.len());
        dst.extend_from_slice(&packet_type.to_be_bytes());
        dst.extend_from_slice(&(payload.len() as u32).to_be_bytes());
        dst.extend_from_slice(&payload);
        Ok(())
    }
}

pub enum MumblePacket {
    Version(Version),
    UDPTunnel(UdpTunnel),
    Authenticate(Authenticate),
    Ping(Ping),
    Reject(Reject),
    ServerSync(ServerSync),
    ChannelRemove(ChannelRemove),
    ChannelState(ChannelState),
    UserRemove(UserRemove),
    UserState(UserState),
    BanList(BanList),
    TextMessage(TextMessage),
    PermissionDenied(PermissionDenied),
    ACL(Acl),
    QueryUsers(QueryUsers),
    CryptSetup(CryptSetup),
    ContextActionModify(ContextActionModify),
    ContextAction(ContextAction),
    UserList(UserList),
    VoiceTarget(VoiceTarget),
    PermissionQuery(PermissionQuery),
    CodecVersion(CodecVersion),
    UserStats(UserStats),
    RequestBlob(RequestBlob),
    ServerConfig(ServerConfig),
    SuggestConfig(SuggestConfig),
}
