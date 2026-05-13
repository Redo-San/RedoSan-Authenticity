use std::io::{Error as IoError, Read, Result as IoResult, Seek, SeekFrom};

use js_sys::Uint8Array;
use web_sys::{Blob, FileReaderSync};

/// Wraps a JS-space Blob and a byte offset to support the implementation of Read + Seek.
pub struct BlobStream<'a> {
    offset: u64,
    blob: &'a Blob,
}

impl<'a> BlobStream<'a> {
    /// Create a new BlobStream from a `web_sys::Blob`.
    pub fn new(blob: &'a Blob) -> Self {
        Self { offset: 0, blob }
    }
}

impl Read for BlobStream<'_> {
    fn read(&mut self, buf: &mut [u8]) -> IoResult<usize> {
        let mut slice: &[u8] = &get_vec_u8_from_blob(self.blob, self.offset, buf.len())?;
        let bytes_read = slice.read(buf)?;
        self.offset += bytes_read as u64;
        Ok(bytes_read)
    }
}

fn get_vec_u8_from_blob(blob: &Blob, offset: u64, len: usize) -> IoResult<Vec<u8>> {
    let end = (blob.size() as u64).min(offset + len as u64);
    let slice = blob
        .slice_with_f64_and_f64(offset as f64, end as f64)
        .map_err(|err| {
            IoError::other(format!(
                "Failed to create slice from blob. Details: {err:?}"
            ))
        })?;

    let reader_sync = FileReaderSync::new().map_err(|err| {
        IoError::other(format!(
            "Failed to create FileReaderSync on blob slice. Details: {err:?}"
        ))
    })?;

    let slice_u8array = reader_sync
        .read_as_array_buffer(&slice)
        .map(|array_buffer| Uint8Array::new(&array_buffer))
        .map_err(|err| IoError::other(format!("Failed to read blob slice. Details: {err:?}")))?;

    let mut buf = vec![0; slice_u8array.byte_length() as usize];
    slice_u8array.copy_to(&mut buf);

    Ok(buf)
}

impl Seek for BlobStream<'_> {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        let new_offset: u64 = match pos {
            SeekFrom::Start(offset) => offset,
            SeekFrom::End(offset) => {
                let pos = (self.blob.size() as i64)
                    .checked_add(offset)
                    .ok_or_else(|| IoError::other("seek overflow"))?;
                if pos < 0 {
                    return Err(IoError::new(
                        std::io::ErrorKind::InvalidInput,
                        "seek before start of stream",
                    ));
                }
                pos as u64
            }
            SeekFrom::Current(offset) => {
                let pos = (self.offset as i64)
                    .checked_add(offset)
                    .ok_or_else(|| IoError::other("seek overflow"))?;
                if pos < 0 {
                    return Err(IoError::new(
                        std::io::ErrorKind::InvalidInput,
                        "seek before start of stream",
                    ));
                }
                pos as u64
            }
        };
        self.offset = new_offset;
        Ok(self.offset)
    }
}

// SAFETY: WASM is single-threaded.
unsafe impl Send for BlobStream<'_> {}
