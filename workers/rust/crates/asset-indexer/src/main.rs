mod cli;

use anyhow::Result;
use clap::Parser;

use crate::cli::Cli;

fn main() -> Result<()> {
    let cli = Cli::parse();
    let result = asset_indexer::index::index_assets(&cli.input);
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}
