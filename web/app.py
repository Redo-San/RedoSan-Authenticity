#!/usr/bin/env python3
import os, sys, json, tempfile, shutil, uuid
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file, after_this_request

WEB_DIR = Path(__file__).parent
ROOT_DIR = WEB_DIR.parent
sys.path.insert(0, str(ROOT_DIR))

from modules.watermark_types import embed, extract, list_watermarks, describe_watermark, WATERMARK_TYPES
from modules.fingerprint import fingerprint_file
from modules.metadata import read_metadata

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024
app.config["UPLOAD_FOLDER"] = str(WEB_DIR / "uploads")

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)


def clean_upload(path):
    try:
        if os.path.isfile(path):
            os.remove(path)
        elif os.path.isdir(path):
            shutil.rmtree(path, ignore_errors=True)
    except:
        pass


def save_upload(file_storage):
    ext = os.path.splitext(file_storage.filename)[1] or ".bin"
    name = uuid.uuid4().hex + ext
    path = os.path.join(app.config["UPLOAD_FOLDER"], name)
    file_storage.save(path)
    return path


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/watermark")
def watermark_page():
    return render_template("watermark.html", types=WATERMARK_TYPES)


@app.route("/fingerprint")
def fingerprint_page():
    return render_template("fingerprint.html")


@app.route("/metadata")
def metadata_page():
    return render_template("metadata.html")


@app.route("/api/watermark/types")
def api_watermark_types():
    return jsonify({"types": WATERMARK_TYPES})


@app.route("/api/watermark/embed", methods=["POST"])
def api_watermark_embed():
    wtype = int(request.form.get("type", 1))
    password = request.form.get("password", "") or None
    image = request.files.get("image")
    secret = request.files.get("secret")  # optional for some types

    if not image:
        return jsonify({"ok": False, "error": "No image file"}), 400

    img_path = save_upload(image)
    secret_path = save_upload(secret) if secret else None
    out_path = img_path + ".output.png"

    try:
        if secret_path:
            ok, msg = embed(wtype, img_path, secret_path, out_path, password)
        else:
            ok, msg = embed(wtype, img_path, img_path, out_path, password)
    except Exception as e:
        ok, msg = False, str(e)

    clean_upload(img_path)
    if secret_path:
        clean_upload(secret_path)

    if not ok:
        clean_upload(out_path)
        return jsonify({"ok": False, "error": str(msg)}), 400

    return send_file(out_path, mimetype="image/png", as_attachment=True,
                     download_name="watermarked.png")


@app.route("/api/watermark/extract", methods=["POST"])
def api_watermark_extract():
    wtype = int(request.form.get("type", 1))
    password = request.form.get("password", "") or None
    image = request.files.get("image")

    if not image:
        return jsonify({"ok": False, "error": "No image file"}), 400

    img_path = save_upload(image)
    out_dir = img_path + ".extracted"
    os.makedirs(out_dir, exist_ok=True)

    try:
        ok, msg = extract(wtype, img_path, out_dir, password)
    except Exception as e:
        ok, msg = False, str(e)

    clean_upload(img_path)

    if not ok:
        shutil.rmtree(out_dir, ignore_errors=True)
        return jsonify({"ok": False, "error": str(msg)}), 400

    files = os.listdir(out_dir)
    if len(files) == 1:
        result_path = os.path.join(out_dir, files[0])
        return send_file(result_path, as_attachment=True,
                         download_name=files[0])
    elif files:
        zip_path = img_path + ".extracted.zip"
        shutil.make_archive(img_path + ".extracted", "zip", out_dir)
        shutil.rmtree(out_dir, ignore_errors=True)
        return send_file(zip_path, as_attachment=True,
                         download_name="extracted.zip")

    shutil.rmtree(out_dir, ignore_errors=True)
    return jsonify({"ok": True, "data": "No files extracted"})


@app.route("/api/fingerprint", methods=["POST"])
def api_fingerprint():
    file = request.files.get("file")
    if not file:
        return jsonify({"ok": False, "error": "No file"}), 400

    path = save_upload(file)
    try:
        result, err = fingerprint_file(path)
    except Exception as e:
        result, err = None, str(e)
    clean_upload(path)

    if err:
        return jsonify({"ok": False, "error": err}), 400
    return jsonify({"ok": True, "fingerprint": result})


@app.route("/api/metadata", methods=["POST"])
def api_metadata():
    file = request.files.get("file")
    if not file:
        return jsonify({"ok": False, "error": "No file"}), 400

    path = save_upload(file)
    try:
        result = read_metadata(path)
    except Exception as e:
        result = {"error": str(e)}
    clean_upload(path)
    return jsonify({"ok": True, "metadata": result})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
