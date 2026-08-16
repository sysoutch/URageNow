mod cli;

use anyhow::Result;
use clap::Parser;
use media_probe::probe_media;

use crate::cli::Cli;

fn main() -> Result<()> {
    let cli = Cli::parse();
    let result = probe_media(&cli.input);
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}
