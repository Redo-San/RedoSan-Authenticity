use std::io::Cursor;

use js_sys::Uint8Array;

use crate::error::WasmError;

pub fn cursor_to_u8array(cursor: Cursor<Vec<u8>>) -> Result<Uint8Array, WasmError> {
    let data = cursor.into_inner();
    let data_len: u32 = data.len().try_into().map_err(WasmError::other)?;
    let uint8array = Uint8Array::new_with_length(data_len);
    uint8array.copy_from(&data);
    Ok(uint8array)
}
