mod cli;

use anyhow::Result;
use clap::Parser;
use model_inspector::inspect_model;

use crate::cli::Cli;

fn main() -> Result<()> {
    let cli = Cli::parse();
    let result = inspect_model(&cli.input);
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}
