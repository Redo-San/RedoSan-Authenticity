use async_trait::async_trait;
use c2pa::SigningAlg;
use c2pa::{AsyncSigner, Result as C2paResult};
use js_sys::{Array, Function as JsFunction, JsString, Number, Promise as JsPromise, Reflect, Uint8Array};
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;

#[wasm_bindgen(typescript_custom_section)]
const SIGNER_DEFINITION: &'static str = r#"
interface SignerDefinition {
    sign: (bytes: Uint8Array<ArrayBuffer>) => Promise<Uint8Array<ArrayBuffer>>;
    reserveSize: number;
    alg: string;
    signingCert?: Uint8Array;
    taCerts?: Uint8Array[];
}
"#;

#[wasm_bindgen]
extern "C" {
    /// Contains the configuration and necessary callbacks for signing.
    #[wasm_bindgen(typescript_type = "SignerDefinition")]
    pub type SignerDefinition;
}

#[derive(Debug)]
#[wasm_bindgen]
pub(crate) struct WasmSigner {
    sign_fn: JsFunction,
    reserve_size: f64,
    signing_alg: SigningAlg,
    signing_cert: Option<Vec<u8>>,
    ta_certs: Vec<Vec<u8>>,
}

/**
 * NOTE: we can only return Err(JsString) or Err(JsValue) as error types here, because for some as-of-yet unknown
 * reason, wasm-bindgen appears to mishandle JsErrors when created in a Firefox web worker.
 *
 * See: https://github.com/wasm-bindgen/wasm-bindgen/issues/4961
 */

#[wasm_bindgen]
impl WasmSigner {
    /// Attempt to create a new [`WasmSigner`] from a SignerDefinition.
    #[wasm_bindgen(js_name = fromDefinition)]
    pub fn from_definition(def: &SignerDefinition) -> Result<Self, JsString> {
        let js_value: JsValue = def.into();

        let reserve_size_result: Number = Reflect::get(&js_value, &"reserveSize".into())?.into();

        let alg_result: JsString = Reflect::get(&js_value, &"alg".into())?.into();

        let signing_alg: SigningAlg = match alg_result.as_string() {
            Some(alg) => match alg.as_str().parse() {
                Ok(alg) => alg,
                Err(_) => SigningAlg::Ps256,
            },
            None => SigningAlg::Ps256,
        };

        let sign_fn: JsFunction = Reflect::get(&js_value, &"sign".into())?.into();

        let signing_cert: Option<Vec<u8>> = Reflect::get(&js_value, &"signingCert".into())
            .ok()
            .and_then(|v| {
                if v.is_undefined() || v.is_null() {
                    None
                } else {
                    let arr = Uint8Array::new(&v);
                    let mut buf = vec![0_u8; arr.length() as usize];
                    arr.copy_to(&mut buf);
                    Some(buf)
                }
            });

        let ta_certs: Vec<Vec<u8>> = Reflect::get(&js_value, &"taCerts".into())
            .ok()
            .map(|v| {
                if v.is_undefined() || v.is_null() {
                    Vec::new()
                } else {
                    let arr = Array::from(&v);
                    let mut certs = Vec::with_capacity(arr.length() as usize);
                    for item in arr.iter() {
                        if item.is_undefined() || item.is_null() {
                            continue;
                        }
                        let u8arr = Uint8Array::new(&item);
                        let mut buf = vec![0_u8; u8arr.length() as usize];
                        u8arr.copy_to(&mut buf);
                        certs.push(buf);
                    }
                    certs
                }
            })
            .unwrap_or_default();

        Ok(WasmSigner {
            reserve_size: reserve_size_result.into(),
            signing_alg,
            sign_fn,
            signing_cert,
            ta_certs,
        })
    }
}

#[async_trait(?Send)]
impl AsyncSigner for WasmSigner {
    async fn sign(&self, data: Vec<u8>) -> C2paResult<Vec<u8>> {
        let len: u32 = data.len().try_into().unwrap();
        let to_be_signed = Uint8Array::new_with_length(len);
        to_be_signed.copy_from(&data);

        let sign_promise: JsPromise = self
            .sign_fn
            .call1(&JsValue::undefined(), &to_be_signed)
            .map_err(|err| c2pa::Error::BadParam(format!("Error calling signer: {err:?}")))?
            .dyn_into()
            .map_err(|err| {
                c2pa::Error::BadParam(format!("Failed to convert sign result to promise: {err:?}"))
            })?;

        let sign_result: Uint8Array = JsFuture::from(sign_promise)
            .await
            .map_err(|err| c2pa::Error::BadParam(format!("Error awaiting sign promise: {err:?}")))?
            .into();

        let mut signed_bytes = vec![0_u8; sign_result.length() as usize];
        sign_result.copy_to(&mut signed_bytes);

        Ok(signed_bytes)
    }

    fn alg(&self) -> SigningAlg {
        self.signing_alg
    }

    fn certs(&self) -> C2paResult<Vec<Vec<u8>>> {
        let mut certs = Vec::new();
        if let Some(cert) = &self.signing_cert {
            certs.push(cert.clone());
        }
        certs.extend(self.ta_certs.clone());
        Ok(certs)
    }

    fn reserve_size(&self) -> usize {
        self.reserve_size as usize
    }

    fn direct_cose_handling(&self) -> bool {
        true
    }
}
