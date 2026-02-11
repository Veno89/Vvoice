use anyhow::Result;
use rcgen::generate_simple_self_signed;
use std::sync::Arc;
use tokio_rustls::rustls::{
    pki_types::{CertificateDer, PrivateKeyDer},
    ServerConfig,
};

pub fn generate_dev_cert() -> Result<Arc<ServerConfig>> {
    let subject_alt_names = vec!["localhost".to_string(), "127.0.0.1".to_string()];
    let cert = generate_simple_self_signed(subject_alt_names)?;

    let cert_der = cert.serialize_der()?;
    let key_der = cert.serialize_private_key_der();

    let cert_chain = vec![CertificateDer::from(cert_der)];
    let key_der = PrivateKeyDer::try_from(key_der).map_err(|e| anyhow::anyhow!(e))?;

    let config = ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(cert_chain, key_der)?;

    Ok(Arc::new(config))
}
