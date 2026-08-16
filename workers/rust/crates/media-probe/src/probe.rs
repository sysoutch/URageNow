use std::{
    fs,
    io::BufReader,
    path::{Path, PathBuf},
};

use image::{AnimationDecoder, ColorType, ImageFormat, ImageReader};
use symphonia::{
    core::{
        codecs::CODEC_TYPE_NULL,
        formats::FormatOptions,
        io::MediaSourceStream,
        meta::MetadataOptions,
        probe::{Hint, ProbeResult},
    },
    default::get_probe,
};
use worker_contracts::{AudioProbe, FileFact, ImageProbe, MediaKind, MediaProbeResult, VideoProbe};

pub fn probe_media(input: &Path) -> MediaProbeResult {
    let file = build_file_fact(input);
    let kind = classify_kind(input);
    let mut result = MediaProbeResult {
        input_path: normalize_path(input),
        file,
        kind,
        probed: false,
        parser: None,
        image: None,
        audio: None,
        video: None,
        warnings: Vec::new(),
    };

    if !result.file.exists {
        result.warnings.push("File does not exist.".to_owned());
        return result;
    }

    if matches!(result.kind, MediaKind::Image) {
        match inspect_image(input) {
            Ok((parser, image)) => {
                result.probed = true;
                result.parser = Some(parser);
                result.image = Some(image);
            }
            Err(error) => {
                result.warnings.push(format!("Image probe failed: {error}"));
            }
        }
        return result;
    }

    if matches!(result.kind, MediaKind::Audio) {
        match inspect_audio(input) {
            Ok(Some((parser, audio))) => {
                result.probed = true;
                result.parser = Some(parser);
                result.audio = Some(audio);
            }
            Ok(None) => {
                result
          .warnings
          .push("Audio probe recognized the file kind, but this codec parser is not implemented yet.".to_owned());
            }
            Err(error) => {
                result.warnings.push(format!("Audio probe failed: {error}"));
            }
        }
        return result;
    }

    if matches!(result.kind, MediaKind::Video) {
        match inspect_video(input) {
            Ok(Some((parser, video))) => {
                result.probed = true;
                result.parser = Some(parser);
                result.video = Some(video);
            }
            Ok(None) => {
                result
          .warnings
          .push("Video probe recognized the file kind, but this codec parser is not implemented yet.".to_owned());
            }
            Err(error) => {
                result.warnings.push(format!("Video probe failed: {error}"));
            }
        }
        return result;
    }

    result
        .warnings
        .push("Probe recognized the file kind, but this parser is not implemented yet.".to_owned());
    result
}

fn build_file_fact(input: &Path) -> FileFact {
    let metadata = fs::metadata(input).ok();
    FileFact {
        exists: metadata.is_some(),
        extension: input
            .extension()
            .map(|value| value.to_string_lossy().to_string()),
        file_name: input
            .file_name()
            .map(|value| value.to_string_lossy().to_string()),
        size_bytes: metadata.map(|value| value.len()),
    }
}

fn normalize_path(input: &Path) -> String {
    input
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(input))
        .to_string_lossy()
        .to_string()
}

fn classify_kind(input: &Path) -> MediaKind {
    let extension = lowercase_extension(input);
    match extension.as_str() {
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "tif" | "tiff" => MediaKind::Image,
        "mp3" | "wav" | "flac" | "ogg" | "m4a" => MediaKind::Audio,
        "mp4" | "mov" | "webm" | "mkv" | "avi" => MediaKind::Video,
        "glb" | "gltf" | "obj" | "fbx" | "blend" => MediaKind::Model3d,
        _ => MediaKind::Unknown,
    }
}

fn inspect_image(input: &Path) -> anyhow::Result<(String, ImageProbe)> {
    let reader = ImageReader::open(input)?.with_guessed_format()?;
    let format = reader.format();
    let parser = format
        .map(image_format_name)
        .unwrap_or_else(|| "image".to_owned());
    let image = reader.decode()?;
    let color = image.color();
    let frame_count = match format {
        Some(ImageFormat::Gif) => read_gif_frame_count(input).ok(),
        _ => None,
    };
    Ok((
        parser,
        ImageProbe {
            width: image.width(),
            height: image.height(),
            color_type: color_type_name(color),
            has_alpha: color.has_alpha(),
            animated: frame_count.map(|count| count > 1).unwrap_or(false),
            frame_count,
        },
    ))
}

fn inspect_audio(input: &Path) -> anyhow::Result<Option<(String, AudioProbe)>> {
    let extension = lowercase_extension(input);
    if extension == "wav" {
        let audio = inspect_wav_audio(input)?;
        return Ok(Some(("wav".to_owned(), audio)));
    }
    inspect_audio_with_symphonia(input)
}

fn read_le_u16(bytes: &[u8], offset: usize) -> anyhow::Result<u16> {
    let Some(slice) = bytes.get(offset..offset + 2) else {
        anyhow::bail!("WAV chunk is truncated.");
    };
    Ok(u16::from_le_bytes([slice[0], slice[1]]))
}

fn read_le_u32(bytes: &[u8], offset: usize) -> anyhow::Result<u32> {
    let Some(slice) = bytes.get(offset..offset + 4) else {
        anyhow::bail!("WAV chunk is truncated.");
    };
    Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn inspect_wav_audio(input: &Path) -> anyhow::Result<AudioProbe> {
    let bytes = fs::read(input)?;
    if bytes.len() < 44 {
        anyhow::bail!("WAV file is too small to contain a valid header.");
    }
    if &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        anyhow::bail!("WAV header is invalid.");
    }

    let mut cursor = 12usize;
    let mut channel_count: Option<u16> = None;
    let mut sample_rate_hz: Option<u32> = None;
    let mut bits_per_sample: Option<u16> = None;
    let mut data_size_bytes: Option<u32> = None;
    let mut codec = "wav".to_owned();

    while cursor + 8 <= bytes.len() {
        let chunk_id = &bytes[cursor..cursor + 4];
        let chunk_size = read_le_u32(&bytes, cursor + 4)? as usize;
        cursor += 8;
        if cursor + chunk_size > bytes.len() {
            break;
        }
        let chunk_data = &bytes[cursor..cursor + chunk_size];
        if chunk_id == b"fmt " && chunk_data.len() >= 16 {
            let format_tag = read_le_u16(chunk_data, 0)?;
            channel_count = Some(read_le_u16(chunk_data, 2)?);
            sample_rate_hz = Some(read_le_u32(chunk_data, 4)?);
            bits_per_sample = Some(read_le_u16(chunk_data, 14)?);
            codec = wav_format_name(format_tag).to_owned();
        } else if chunk_id == b"data" {
            data_size_bytes = Some(chunk_size as u32);
        }
        cursor += chunk_size + (chunk_size % 2);
    }

    let duration_seconds = match (
        data_size_bytes,
        channel_count,
        sample_rate_hz,
        bits_per_sample,
    ) {
        (Some(data_size), Some(channels), Some(sample_rate), Some(bits))
            if channels > 0 && sample_rate > 0 && bits > 0 =>
        {
            let bytes_per_sample_frame = (channels as f64) * ((bits as f64) / 8.0);
            if bytes_per_sample_frame > 0.0 {
                Some((data_size as f64) / bytes_per_sample_frame / (sample_rate as f64))
            } else {
                None
            }
        }
        _ => None,
    };

    Ok(AudioProbe {
        codec,
        duration_seconds,
        channel_count,
        sample_rate_hz,
        bits_per_sample,
    })
}

fn inspect_audio_with_symphonia(input: &Path) -> anyhow::Result<Option<(String, AudioProbe)>> {
    let probed = probe_with_symphonia(input)?;
    let format = probed.format;
    let track = format.default_track().or_else(|| {
        format
            .tracks()
            .iter()
            .find(|entry| entry.codec_params.codec != CODEC_TYPE_NULL)
    });
    let Some(track) = track else {
        return Ok(None);
    };
    let params = &track.codec_params;
    let duration_seconds = codec_duration_seconds(params);
    let channel_count = params.channels.map(|channels| channels.count() as u16);
    let parser = parser_name(input, "audio");
    Ok(Some((
        parser,
        AudioProbe {
            codec: symphonia_codec_name(params.codec),
            duration_seconds,
            channel_count,
            sample_rate_hz: params.sample_rate,
            bits_per_sample: params
                .bits_per_sample
                .and_then(|bits| u16::try_from(bits).ok()),
        },
    )))
}

fn inspect_video(input: &Path) -> anyhow::Result<Option<(String, VideoProbe)>> {
    let probed = probe_with_symphonia(input)?;
    let format = probed.format;
    let track_count = u32::try_from(format.tracks().len()).ok();
    let track = format
        .tracks()
        .iter()
        .find(|entry| is_likely_video_track(&entry.codec_params))
        .or_else(|| {
            format
                .tracks()
                .iter()
                .find(|entry| entry.codec_params.codec != CODEC_TYPE_NULL)
        });
    let Some(track) = track else {
        return Ok(None);
    };
    let params = &track.codec_params;
    let duration_seconds = format
        .tracks()
        .iter()
        .filter_map(|entry| codec_duration_seconds(&entry.codec_params))
        .fold(None, |current, duration| {
            Some(current.map_or(duration, |value: f64| value.max(duration)))
        });
    let average_frame_rate = params.n_frames.and_then(|frame_count| {
        duration_seconds.and_then(|duration| {
            if duration > 0.0 {
                Some((frame_count as f64) / duration)
            } else {
                None
            }
        })
    });
    let parser = parser_name(input, "video");
    Ok(Some((
        parser.clone(),
        VideoProbe {
            codec: symphonia_codec_name(params.codec),
            container: parser,
            duration_seconds,
            track_count,
            frame_count: params.n_frames,
            average_frame_rate,
        },
    )))
}

fn probe_with_symphonia(input: &Path) -> anyhow::Result<ProbeResult> {
    let file = fs::File::open(input)?;
    let media_stream = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(extension) = input.extension().and_then(|value| value.to_str()) {
        hint.with_extension(extension);
    }
    Ok(get_probe().format(
        &hint,
        media_stream,
        &FormatOptions::default(),
        &MetadataOptions::default(),
    )?)
}

fn is_likely_video_track(params: &symphonia::core::codecs::CodecParameters) -> bool {
    params.codec != CODEC_TYPE_NULL && params.channels.is_none() && params.sample_rate.is_none()
}

fn lowercase_extension(input: &Path) -> String {
    input
        .extension()
        .map(|value| value.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default()
}

fn parser_name(input: &Path, fallback: &str) -> String {
    let extension = lowercase_extension(input);
    if extension.is_empty() {
        fallback.to_owned()
    } else {
        extension
    }
}

fn codec_duration_seconds(params: &symphonia::core::codecs::CodecParameters) -> Option<f64> {
    params
        .n_frames
        .zip(params.time_base)
        .map(|(frames, time_base)| {
            let time = time_base.calc_time(frames);
            time.seconds as f64 + time.frac
        })
}

fn read_gif_frame_count(input: &Path) -> anyhow::Result<u32> {
    let file = BufReader::new(fs::File::open(input)?);
    let decoder = image::codecs::gif::GifDecoder::new(file)?;
    let frames = decoder.into_frames().collect_frames()?;
    Ok(frames.len() as u32)
}

fn wav_format_name(format_tag: u16) -> &'static str {
    match format_tag {
        0x0001 => "pcm",
        0x0003 => "ieee-float",
        0x0006 => "a-law",
        0x0007 => "mu-law",
        0xfffe => "wave-format-extensible",
        _ => "wav",
    }
}

fn symphonia_codec_name(codec: symphonia::core::codecs::CodecType) -> String {
    let raw = format!("{codec:?}");
    let normalized = raw
        .trim_start_matches("CODEC_TYPE_")
        .trim()
        .to_ascii_lowercase();
    if normalized.is_empty() || normalized == "null" {
        "unknown".to_owned()
    } else {
        normalized
    }
}

fn image_format_name(format: ImageFormat) -> String {
    match format {
        ImageFormat::Png => "png",
        ImageFormat::Jpeg => "jpeg",
        ImageFormat::Gif => "gif",
        ImageFormat::WebP => "webp",
        ImageFormat::Bmp => "bmp",
        ImageFormat::Tiff => "tiff",
        _ => "image",
    }
    .to_owned()
}

fn color_type_name(color: ColorType) -> String {
    match color {
        ColorType::L8 => "l8",
        ColorType::La8 => "la8",
        ColorType::Rgb8 => "rgb8",
        ColorType::Rgba8 => "rgba8",
        ColorType::L16 => "l16",
        ColorType::La16 => "la16",
        ColorType::Rgb16 => "rgb16",
        ColorType::Rgba16 => "rgba16",
        ColorType::Rgb32F => "rgb32f",
        ColorType::Rgba32F => "rgba32f",
        _ => "unknown",
    }
    .to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_media_path(file_name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("urage-media-probe-{unique}-{file_name}"))
    }

    fn write_pcm_wav(
        path: &Path,
        sample_rate_hz: u32,
        channel_count: u16,
        bits_per_sample: u16,
        sample_count: usize,
    ) {
        let bytes_per_sample = usize::from(bits_per_sample / 8);
        let data_size = sample_count * usize::from(channel_count) * bytes_per_sample;
        let byte_rate = sample_rate_hz * u32::from(channel_count) * u32::from(bits_per_sample) / 8;
        let block_align = channel_count * bits_per_sample / 8;
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&(36u32 + data_size as u32).to_le_bytes());
        bytes.extend_from_slice(b"WAVEfmt ");
        bytes.extend_from_slice(&16u32.to_le_bytes());
        bytes.extend_from_slice(&1u16.to_le_bytes());
        bytes.extend_from_slice(&channel_count.to_le_bytes());
        bytes.extend_from_slice(&sample_rate_hz.to_le_bytes());
        bytes.extend_from_slice(&byte_rate.to_le_bytes());
        bytes.extend_from_slice(&block_align.to_le_bytes());
        bytes.extend_from_slice(&bits_per_sample.to_le_bytes());
        bytes.extend_from_slice(b"data");
        bytes.extend_from_slice(&(data_size as u32).to_le_bytes());
        bytes.resize(bytes.len() + data_size, 0);
        fs::write(path, bytes).expect("test wav should be writable");
    }

    #[test]
    fn reports_missing_files_without_panicking() {
        let path = temp_media_path("missing.wav");
        let result = probe_media(&path);
        assert!(!result.file.exists);
        assert!(!result.probed);
        assert!(result
            .warnings
            .iter()
            .any(|warning| warning.contains("File does not exist")));
    }

    #[test]
    fn probes_basic_wav_metadata() {
        let path = temp_media_path("tone.wav");
        write_pcm_wav(&path, 8000, 1, 16, 8000);
        let result = probe_media(&path);
        let _ = fs::remove_file(&path);
        assert!(matches!(result.kind, MediaKind::Audio));
        assert!(result.probed);
        assert_eq!(result.parser.as_deref(), Some("wav"));
        let audio = result
            .audio
            .as_ref()
            .expect("wav probe should return audio facts");
        assert_eq!(audio.codec, "pcm");
        assert_eq!(audio.channel_count, Some(1));
        assert_eq!(audio.sample_rate_hz, Some(8000));
        assert_eq!(audio.bits_per_sample, Some(16));
        assert_eq!(audio.duration_seconds, Some(1.0));
    }
}
