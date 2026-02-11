fn main() {
    let protoc = protoc_bin_vendored::protoc_bin_path().expect("failed to locate protoc");
    std::env::set_var("PROTOC", protoc);

    prost_build::compile_protos(&["../proto/Mumble.proto"], &["../proto/"])
        .expect("failed to compile backend protobufs");
}
