use clap::Parser;

#[derive(Debug, Parser)]
#[command(name = "asset-validator")]
#[command(about = "Validate a 3D asset and return structured JSON issues.")]
pub struct Cli {
    #[arg(long)]
    pub input: String,
}
