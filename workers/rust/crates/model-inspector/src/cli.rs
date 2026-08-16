use clap::Parser;

#[derive(Debug, Parser)]
#[command(name = "model-inspector")]
#[command(about = "Inspect a 3D model file and return structured JSON metadata.")]
pub struct Cli {
    #[arg(long)]
    pub input: String,
}
