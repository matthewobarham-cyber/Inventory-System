from __future__ import annotations

import json
import struct
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT / "models"

COMPONENT_TYPES = {
    5120: ("i1", 1),
    5121: ("u1", 1),
    5122: ("<i2", 2),
    5123: ("<u2", 2),
    5125: ("<u4", 4),
    5126: ("<f4", 4),
}
TYPE_COUNTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def load_glb(path: Path):
    raw = path.read_bytes()
    magic, version, declared_length = struct.unpack("<4sII", raw[:12])
    assert magic == b"glTF", f"{path.name}: invalid magic"
    assert version == 2, f"{path.name}: expected glTF 2.0"
    assert declared_length == len(raw), f"{path.name}: incorrect declared length"
    offset = 12
    chunks = {}
    while offset < len(raw):
        length, kind = struct.unpack("<I4s", raw[offset:offset + 8])
        offset += 8
        chunks[kind] = raw[offset:offset + length]
        offset += length
    document = json.loads(chunks[b"JSON"].decode("utf-8"))
    binary = chunks[b"BIN\x00"]
    return document, binary


def accessor_array(document, binary, accessor_index):
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    dtype, byte_size = COMPONENT_TYPES[accessor["componentType"]]
    components = TYPE_COUNTS[accessor["type"]]
    byte_offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    byte_length = accessor["count"] * components * byte_size
    assert byte_offset + byte_length <= len(binary)
    array = np.frombuffer(binary, dtype=dtype, count=accessor["count"] * components, offset=byte_offset)
    return array.reshape(accessor["count"], components)


def validate(path: Path):
    document, binary = load_glb(path)
    assert document["asset"]["version"] == "2.0"
    assert document["scene"] == 0
    assert document["scenes"][0]["nodes"] == [0]
    assert document["nodes"][0]["mesh"] == 0
    assert document["materials"]
    triangles = 0
    vertices = 0
    for primitive in document["meshes"][0]["primitives"]:
        positions = accessor_array(document, binary, primitive["attributes"]["POSITION"])
        normals = accessor_array(document, binary, primitive["attributes"]["NORMAL"])
        indices = accessor_array(document, binary, primitive["indices"]).reshape(-1)
        assert positions.shape == normals.shape
        assert positions.shape[1] == 3
        assert np.isfinite(positions).all()
        assert np.isfinite(normals).all()
        assert indices.max(initial=0) < len(positions)
        assert len(indices) % 3 == 0
        lengths = np.linalg.norm(normals, axis=1)
        assert np.all((lengths > 0.98) & (lengths < 1.02))
        triangles += len(indices) // 3
        vertices += len(positions)
    assert triangles > 0
    return triangles, vertices, len(document["materials"])


if __name__ == "__main__":
    total_triangles = 0
    for model_path in sorted(MODEL_DIR.glob("*.glb")):
        triangles, vertices, materials = validate(model_path)
        total_triangles += triangles
        print(
            f"{model_path.name:32} "
            f"{triangles:6} triangles · {vertices:6} vertices · {materials:2} materials"
        )
    assert len(list(MODEL_DIR.glob("*.glb"))) == 19
    print(f"PASS · 19 GLB files · {total_triangles} total triangles")
