from __future__ import annotations

import json
import math
import struct
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"
PREVIEWS_DIR = ROOT / "previews"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)


PALETTE = {
    "graphite": (0.105, 0.125, 0.14, 1.0),
    "dark": (0.045, 0.055, 0.065, 1.0),
    "mid": (0.24, 0.27, 0.30, 1.0),
    "blue": (0.18, 0.43, 0.70, 1.0),
    "uwi_blue": (0.35, 0.50, 0.65, 1.0),
    "light_blue": (0.48, 0.70, 0.88, 1.0),
    "silver": (0.64, 0.67, 0.69, 1.0),
    "offwhite": (0.88, 0.89, 0.87, 1.0),
    "white": (0.97, 0.97, 0.96, 1.0),
    "cyan": (0.18, 0.72, 0.79, 1.0),
    "yellow": (0.94, 0.69, 0.12, 1.0),
    "magenta": (0.74, 0.16, 0.46, 1.0),
    "red": (0.72, 0.13, 0.13, 1.0),
    "green": (0.28, 0.67, 0.39, 1.0),
    "orange": (0.95, 0.43, 0.12, 1.0),
    "copper": (0.70, 0.36, 0.16, 1.0),
    "drum": (0.08, 0.66, 0.72, 1.0),
    "screen": (0.94, 0.95, 0.95, 1.0),
}


MATERIAL_PROPERTIES = {
    "graphite": (0.15, 0.72),
    "dark": (0.05, 0.8),
    "mid": (0.18, 0.65),
    "blue": (0.12, 0.55),
    "uwi_blue": (0.12, 0.6),
    "light_blue": (0.05, 0.5),
    "silver": (0.65, 0.32),
    "offwhite": (0.05, 0.74),
    "white": (0.02, 0.68),
    "copper": (0.75, 0.3),
    "drum": (0.45, 0.28),
}


@dataclass
class Geometry:
    positions: list[tuple[float, float, float]] = field(default_factory=list)
    normals: list[tuple[float, float, float]] = field(default_factory=list)
    indices: list[int] = field(default_factory=list)


class Model:
    def __init__(self, name: str):
        self.name = name
        self.groups: dict[str, Geometry] = {}

    def geom(self, material: str) -> Geometry:
        if material not in self.groups:
            self.groups[material] = Geometry()
        return self.groups[material]

    def triangle(self, a, b, c, material: str, normals=None):
        g = self.geom(material)
        a = np.asarray(a, dtype=float)
        b = np.asarray(b, dtype=float)
        c = np.asarray(c, dtype=float)
        if normals is None:
            normal = np.cross(b - a, c - a)
            length = np.linalg.norm(normal)
            normal = normal / length if length else np.array([0.0, 1.0, 0.0])
            ns = [normal, normal, normal]
        else:
            ns = [np.asarray(n, dtype=float) for n in normals]
        base = len(g.positions)
        g.positions.extend([tuple(a), tuple(b), tuple(c)])
        g.normals.extend([tuple(n) for n in ns])
        g.indices.extend([base, base + 1, base + 2])

    def quad(self, a, b, c, d, material: str, normal=None):
        normals = [normal] * 3 if normal is not None else None
        self.triangle(a, b, c, material, normals)
        self.triangle(a, c, d, material, normals)

    def box(self, center, size, material: str, rotation_y=0.0):
        cx, cy, cz = center
        sx, sy, sz = np.asarray(size, dtype=float) / 2.0
        points = np.array(
            [
                [-sx, -sy, -sz], [sx, -sy, -sz], [sx, sy, -sz], [-sx, sy, -sz],
                [-sx, -sy, sz], [sx, -sy, sz], [sx, sy, sz], [-sx, sy, sz],
            ],
            dtype=float,
        )
        if rotation_y:
            c, s = math.cos(rotation_y), math.sin(rotation_y)
            rot = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
            points = points @ rot.T
        points += np.array(center)
        faces = [
            (0, 3, 2, 1), (4, 5, 6, 7), (0, 4, 7, 3),
            (1, 2, 6, 5), (3, 7, 6, 2), (0, 1, 5, 4),
        ]
        for face in faces:
            self.quad(*(points[i] for i in face), material)

    def cylinder(self, center, radius, length, material: str, axis=(0, 1, 0), segments=16):
        axis = np.asarray(axis, dtype=float)
        axis /= np.linalg.norm(axis)
        helper = np.array([1.0, 0.0, 0.0])
        if abs(np.dot(axis, helper)) > 0.9:
            helper = np.array([0.0, 1.0, 0.0])
        u = np.cross(axis, helper)
        u /= np.linalg.norm(u)
        v = np.cross(axis, u)
        center = np.asarray(center, dtype=float)
        low = center - axis * length / 2
        high = center + axis * length / 2
        low_ring, high_ring = [], []
        for i in range(segments):
            angle = 2 * math.pi * i / segments
            offset = radius * (u * math.cos(angle) + v * math.sin(angle))
            low_ring.append(low + offset)
            high_ring.append(high + offset)
        for i in range(segments):
            j = (i + 1) % segments
            n1 = (low_ring[i] - low) / radius
            n2 = (low_ring[j] - low) / radius
            self.triangle(low_ring[i], low_ring[j], high_ring[j], material, [n1, n2, n2])
            self.triangle(low_ring[i], high_ring[j], high_ring[i], material, [n1, n2, n1])
            self.triangle(low, low_ring[j], low_ring[i], material)
            self.triangle(high, high_ring[i], high_ring[j], material)

    def cylinder_between(self, a, b, radius, material: str, segments=12):
        a, b = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
        delta = b - a
        length = np.linalg.norm(delta)
        if length > 1e-6:
            self.cylinder((a + b) / 2, radius, length, material, delta, segments)

    def sphere(self, center, radius, material: str, rings=6, segments=12, scale=(1, 1, 1)):
        center = np.asarray(center, dtype=float)
        scale = np.asarray(scale, dtype=float)
        for r in range(rings):
            p0 = -math.pi / 2 + math.pi * r / rings
            p1 = -math.pi / 2 + math.pi * (r + 1) / rings
            for s in range(segments):
                t0 = 2 * math.pi * s / segments
                t1 = 2 * math.pi * (s + 1) / segments

                def point(phi, theta):
                    return center + radius * scale * np.array(
                        [math.cos(phi) * math.cos(theta), math.sin(phi), math.cos(phi) * math.sin(theta)]
                    )

                a, b, c, d = point(p0, t0), point(p0, t1), point(p1, t1), point(p1, t0)
                self.triangle(a, b, c, material)
                self.triangle(a, c, d, material)

    def torus(self, center, major, minor, material: str, axis=(0, 1, 0), segments=28, tube_segments=8):
        axis = np.asarray(axis, dtype=float)
        axis /= np.linalg.norm(axis)
        helper = np.array([1.0, 0.0, 0.0])
        if abs(np.dot(axis, helper)) > 0.9:
            helper = np.array([0.0, 1.0, 0.0])
        u = np.cross(axis, helper)
        u /= np.linalg.norm(u)
        v = np.cross(axis, u)
        center = np.asarray(center, dtype=float)
        for i in range(segments):
            a0, a1 = 2 * math.pi * i / segments, 2 * math.pi * (i + 1) / segments
            for j in range(tube_segments):
                b0, b1 = 2 * math.pi * j / tube_segments, 2 * math.pi * (j + 1) / tube_segments

                def point(a, b):
                    radial = u * math.cos(a) + v * math.sin(a)
                    tangent_out = radial * math.cos(b) + axis * math.sin(b)
                    return center + radial * major + tangent_out * minor

                self.quad(point(a0, b0), point(a1, b0), point(a1, b1), point(a0, b1), material)

    def cable_loop(self, center, radius, wire_radius, material, turns=1.0, y=0.0, gap=0.012, segments=48):
        cx, _, cz = center
        points = []
        for i in range(segments + 1):
            t = i / segments * math.pi * 2 * turns
            r = radius + gap * (i / segments - 0.5)
            points.append((cx + r * math.cos(t), y + 0.006 * math.sin(t * 2), cz + r * math.sin(t)))
        for a, b in zip(points, points[1:]):
            self.cylinder_between(a, b, wire_radius, material, 8)
        return points

    def bounds(self):
        pts = [p for g in self.groups.values() for p in g.positions]
        arr = np.asarray(pts)
        return arr.min(axis=0), arr.max(axis=0)


def add_usb_c_connector(m: Model, center, direction=(1, 0, 0), material="silver"):
    x, y, z = center
    axis = np.asarray(direction, dtype=float)
    axis /= np.linalg.norm(axis)
    m.cylinder(center, 0.012, 0.028, material, axis, 12)
    inner = np.asarray(center) + axis * 0.016
    m.cylinder(inner, 0.0065, 0.004, "dark", axis, 12)


def add_hdmi_connector(m: Model, center, direction=(1, 0, 0)):
    axis = np.asarray(direction, dtype=float)
    axis /= np.linalg.norm(axis)
    c = np.asarray(center)
    m.box(c, (0.036, 0.016, 0.028), "graphite")
    m.box(c + axis * 0.026, (0.024, 0.012, 0.021), "silver")
    m.box(c + axis * 0.038, (0.018, 0.006, 0.014), "dark")


def add_xlr_connector(m: Model, center, direction=(1, 0, 0), female=False):
    axis = np.asarray(direction, dtype=float)
    axis /= np.linalg.norm(axis)
    c = np.asarray(center)
    m.cylinder(c, 0.018, 0.045, "mid", axis, 16)
    end = c + axis * 0.028
    m.cylinder(end, 0.016, 0.012, "silver", axis, 16)
    for angle in (-0.75, 0, 0.75):
        offset = np.array([0, math.cos(angle) * 0.007, math.sin(angle) * 0.007])
        m.cylinder(end + axis * 0.008 + offset, 0.0022, 0.008, "dark" if female else "silver", axis, 8)


def add_rj45(m: Model, center, direction=(1, 0, 0)):
    axis = np.asarray(direction, dtype=float)
    axis /= np.linalg.norm(axis)
    c = np.asarray(center)
    m.box(c, (0.025, 0.014, 0.020), "light_blue")
    m.box(c + axis * 0.015, (0.015, 0.010, 0.016), "offwhite")
    m.box(c + np.array([0, 0.011, 0]), (0.020, 0.003, 0.007), "light_blue")
    for i in range(5):
        m.box(c + axis * 0.023 + np.array([0, 0.003, (i - 2) * 0.003]), (0.002, 0.005, 0.0015), "copper")


def model_usb_cable():
    m = Model("USB-C Cable")
    points = m.cable_loop((0, 0, 0), 0.105, 0.004, "graphite", 1.35, 0.015, 0.026, 55)
    m.cylinder_between(points[0], (-0.17, 0.02, -0.10), 0.004, "graphite", 8)
    m.cylinder_between(points[-1], (0.17, 0.02, -0.10), 0.004, "graphite", 8)
    add_usb_c_connector(m, (-0.19, 0.02, -0.10), (-1, 0, 0))
    add_usb_c_connector(m, (0.19, 0.02, -0.10), (1, 0, 0))
    return m


def model_hdmi_cable():
    m = Model("HDMI Cable")
    points = m.cable_loop((0, 0, 0), 0.115, 0.0055, "dark", 1.3, 0.018, 0.028, 54)
    m.cylinder_between(points[0], (-0.17, 0.025, -0.105), 0.0055, "dark", 8)
    m.cylinder_between(points[-1], (0.17, 0.025, -0.105), 0.0055, "dark", 8)
    add_hdmi_connector(m, (-0.19, 0.025, -0.105), (-1, 0, 0))
    add_hdmi_connector(m, (0.19, 0.025, -0.105), (1, 0, 0))
    return m


def model_display_adapter():
    m = Model("USB-C Display Adapter")
    m.box((0, 0.028, 0), (0.145, 0.026, 0.072), "offwhite")
    m.box((0.055, 0.043, 0), (0.025, 0.004, 0.010), "uwi_blue")
    m.box((-0.074, 0.028, 0), (0.008, 0.012, 0.040), "dark")
    m.cylinder_between((0.073, 0.028, 0), (0.145, 0.034, 0.03), 0.004, "graphite", 8)
    add_usb_c_connector(m, (0.162, 0.036, 0.038), (1, 0, 0))
    return m


def model_xlr_cable():
    m = Model("XLR Cable")
    points = m.cable_loop((0, 0, 0), 0.12, 0.006, "graphite", 1.45, 0.018, 0.031, 58)
    m.cylinder_between(points[0], (-0.18, 0.026, -0.11), 0.006, "graphite", 8)
    m.cylinder_between(points[-1], (0.18, 0.026, -0.11), 0.006, "graphite", 8)
    add_xlr_connector(m, (-0.20, 0.026, -0.11), (-1, 0, 0), True)
    add_xlr_connector(m, (0.20, 0.026, -0.11), (1, 0, 0), False)
    return m


def model_ethernet():
    m = Model("Blue Ethernet Cable")
    points = m.cable_loop((0, 0, 0), 0.112, 0.0045, "blue", 1.4, 0.017, 0.027, 56)
    m.cylinder_between(points[0], (-0.17, 0.025, -0.10), 0.0045, "blue", 8)
    m.cylinder_between(points[-1], (0.17, 0.025, -0.10), 0.0045, "blue", 8)
    add_rj45(m, (-0.19, 0.025, -0.10), (-1, 0, 0))
    add_rj45(m, (0.19, 0.025, -0.10), (1, 0, 0))
    return m


def model_laptop_charger():
    m = Model("Laptop Charger")
    m.box((0, 0.045, 0), (0.145, 0.070, 0.078), "graphite")
    m.box((0, 0.082, 0), (0.055, 0.003, 0.012), "uwi_blue")
    m.cylinder_between((-0.073, 0.045, 0), (-0.18, 0.03, -0.06), 0.004, "dark", 8)
    m.cable_loop((-0.22, 0, -0.08), 0.055, 0.0037, "dark", 1.1, 0.02, 0.012, 34)
    m.cylinder_between((0.073, 0.045, 0), (0.18, 0.03, 0.06), 0.0035, "dark", 8)
    add_usb_c_connector(m, (0.20, 0.03, 0.07), (1, 0, 0))
    return m


def model_printer_toner():
    m = Model("Printer Toner Cartridge")
    m.box((0, 0.07, 0), (0.30, 0.105, 0.095), "graphite")
    m.cylinder((0, 0.024, 0.045), 0.026, 0.27, "dark", (1, 0, 0), 16)
    m.box((0, 0.132, -0.005), (0.14, 0.012, 0.035), "mid")
    m.box((0, 0.142, -0.005), (0.075, 0.024, 0.022), "graphite")
    m.box((-0.10, 0.124, -0.049), (0.05, 0.012, 0.004), "uwi_blue")
    return m


def model_waste_toner():
    m = Model("Waste Toner Container")
    m.box((0, 0.09, 0), (0.22, 0.17, 0.10), "offwhite")
    m.box((0, 0.165, 0), (0.19, 0.022, 0.082), "graphite")
    m.box((0, 0.195, 0), (0.095, 0.040, 0.025), "mid")
    m.box((-0.072, 0.09, 0.052), (0.045, 0.07, 0.006), "uwi_blue")
    m.cylinder((0.078, 0.145, 0), 0.018, 0.028, "dark", (0, 1, 0), 12)
    return m


def model_imaging_unit():
    m = Model("Printer Imaging Unit")
    m.box((0, 0.085, 0), (0.31, 0.13, 0.105), "graphite")
    m.cylinder((0, 0.055, 0.058), 0.047, 0.27, "drum", (1, 0, 0), 24)
    m.cylinder((0, 0.055, 0.060), 0.012, 0.292, "silver", (1, 0, 0), 12)
    m.box((0, 0.16, -0.02), (0.12, 0.025, 0.075), "mid")
    m.box((0.09, 0.174, -0.02), (0.055, 0.012, 0.03), "cyan")
    return m


def model_transfer_belt():
    m = Model("Printer Transfer Belt")
    m.box((0, 0.035, 0), (0.36, 0.045, 0.19), "graphite")
    m.box((0, 0.060, 0), (0.31, 0.016, 0.145), "dark")
    m.box((0, 0.070, 0), (0.25, 0.005, 0.105), "mid")
    for x in (-0.145, 0.145):
        m.cylinder((x, 0.063, 0), 0.028, 0.14, "silver", (0, 0, 1), 16)
    m.box((0, 0.048, -0.095), (0.14, 0.05, 0.025), "graphite")
    m.box((0.08, 0.077, -0.096), (0.055, 0.008, 0.026), "uwi_blue")
    return m


def model_surge_protector():
    m = Model("Surge Protector")
    m.box((0, 0.035, 0), (0.34, 0.05, 0.09), "offwhite")
    for x in np.linspace(-0.12, 0.11, 5):
        m.box((x, 0.063, 0), (0.035, 0.005, 0.043), "dark")
        m.box((x - 0.008, 0.067, 0), (0.004, 0.004, 0.018), "offwhite")
        m.box((x + 0.008, 0.067, 0), (0.004, 0.004, 0.018), "offwhite")
    m.box((0.145, 0.064, 0), (0.024, 0.006, 0.040), "red")
    m.cylinder_between((-0.17, 0.035, 0), (-0.29, 0.025, -0.055), 0.005, "graphite", 8)
    return m


def model_ups():
    m = Model("Uninterruptible Power Supply")
    m.box((0, 0.14, 0), (0.22, 0.28, 0.19), "graphite")
    m.box((0, 0.14, 0.097), (0.185, 0.235, 0.008), "dark")
    m.box((0, 0.205, 0.103), (0.105, 0.055, 0.006), "mid")
    m.box((0, 0.205, 0.107), (0.075, 0.034, 0.003), "blue")
    m.cylinder((-0.065, 0.095, 0.104), 0.012, 0.006, "uwi_blue", (0, 0, 1), 16)
    for y in (0.058, 0.083, 0.108):
        m.box((0.05, y, 0.103), (0.055, 0.004, 0.004), "mid")
    for x in (-0.075, 0.075):
        m.box((x, -0.005, 0), (0.035, 0.012, 0.13), "dark")
    return m


def model_office_phone():
    m = Model("Landline Office Phone")
    m.box((0, 0.045, 0), (0.25, 0.07, 0.20), "graphite")
    m.box((0.035, 0.092, -0.035), (0.10, 0.010, 0.065), "dark")
    m.box((0.035, 0.098, -0.035), (0.08, 0.004, 0.046), "light_blue")
    for row in range(4):
        for col in range(3):
            m.cylinder((-0.005 + col * 0.031, 0.087, 0.025 + row * 0.027), 0.007, 0.008, "mid", (0, 1, 0), 10)
    # Handset as three softly connected forms
    m.cylinder((-0.085, 0.112, 0), 0.022, 0.16, "mid", (0, 0, 1), 14)
    m.sphere((-0.085, 0.112, -0.082), 0.031, "mid", 5, 12, (1.15, 0.75, 1))
    m.sphere((-0.085, 0.112, 0.082), 0.031, "mid", 5, 12, (1.15, 0.75, 1))
    return m


def model_microphone():
    m = Model("Professional Microphone")
    m.cylinder((0, 0.13, 0), 0.018, 0.22, "graphite", (0, 1, 0), 18)
    m.cylinder((0, 0.255, 0), 0.032, 0.075, "silver", (0, 1, 0), 20)
    m.sphere((0, 0.297, 0), 0.034, "silver", 7, 18, (1, 1.15, 1))
    for y in np.linspace(0.262, 0.325, 5):
        m.torus((0, y, 0), 0.028, 0.0015, "dark", (0, 1, 0), 18, 5)
    m.cylinder((0, 0.012, 0), 0.014, 0.018, "silver", (0, 1, 0), 16)
    m.sphere((0, 0.158, 0.018), 0.005, "uwi_blue", 4, 8)
    return m


def model_mixer():
    m = Model("Audio Mixer")
    m.box((0, 0.045, 0), (0.36, 0.07, 0.25), "graphite")
    m.box((0, 0.085, -0.02), (0.34, 0.015, 0.20), "mid")
    colors = ["red", "yellow", "green", "blue"]
    for col in range(8):
        x = -0.145 + col * 0.0415
        for row in range(3):
            m.cylinder((x, 0.099, -0.072 + row * 0.037), 0.008, 0.012, colors[(col + row) % 4], (0, 1, 0), 12)
        m.box((x, 0.101, 0.065), (0.007, 0.010, 0.085), "dark")
        m.box((x, 0.11, 0.06 - (col % 4) * 0.012), (0.023, 0.014, 0.014), "offwhite")
    m.box((0.12, 0.102, -0.075), (0.075, 0.008, 0.040), "light_blue")
    m.box((0.12, 0.107, -0.075), (0.055, 0.003, 0.025), "dark")
    return m


def model_projector_screen():
    m = Model("Projector Screen")
    m.cylinder((0, 0.30, 0), 0.018, 0.48, "graphite", (1, 0, 0), 16)
    m.box((0, 0.16, 0), (0.44, 0.26, 0.008), "screen")
    m.box((0, 0.025, 0), (0.47, 0.015, 0.015), "graphite")
    m.cylinder((0, 0.005, 0), 0.012, 0.045, "graphite", (0, 1, 0), 12)
    m.cylinder((0, -0.17, 0), 0.010, 0.34, "mid", (0, 1, 0), 12)
    for angle in (0.1, 2.2, 4.3):
        end = (0.22 * math.cos(angle), -0.34, 0.22 * math.sin(angle))
        m.cylinder_between((0, -0.27, 0), end, 0.007, "graphite", 10)
    return m


def model_mic_stand():
    m = Model("Microphone Stand")
    m.cylinder((0, 0.22, 0), 0.009, 0.44, "graphite", (0, 1, 0), 12)
    m.cylinder_between((0, 0.41, 0), (0.25, 0.50, 0), 0.008, "graphite", 12)
    m.cylinder((0.255, 0.502, 0), 0.017, 0.04, "mid", (1, 0, 0), 12)
    m.cylinder((0, 0.01, 0), 0.026, 0.035, "mid", (0, 1, 0), 14)
    for angle in (0.15, 2.25, 4.35):
        end = (0.22 * math.cos(angle), -0.08, 0.22 * math.sin(angle))
        m.cylinder_between((0, 0.02, 0), end, 0.008, "graphite", 10)
        m.sphere(end, 0.013, "dark", 4, 8)
    m.cylinder((0, 0.25, 0), 0.017, 0.018, "uwi_blue", (0, 1, 0), 12)
    return m


def model_external_hard_drive():
    m = Model("External Hard Drive")
    m.box((0, 0.025, 0), (0.16, 0.042, 0.105), "graphite")
    m.box((0, 0.048, 0), (0.14, 0.006, 0.083), "mid")
    for x in np.linspace(-0.055, 0.055, 6):
        m.box((x, 0.053, 0), (0.004, 0.003, 0.07), "dark")
    m.sphere((0.055, 0.055, -0.035), 0.005, "uwi_blue", 4, 8)
    m.box((-0.081, 0.026, 0), (0.005, 0.014, 0.036), "silver")
    m.cylinder_between((-0.083, 0.026, 0), (-0.20, 0.02, -0.055), 0.0035, "graphite", 8)
    add_usb_c_connector(m, (-0.22, 0.02, -0.065), (-1, 0, 0))
    return m


def model_clicker():
    m = Model("Presentation Clicker")
    m.box((0, 0.025, 0), (0.065, 0.040, 0.18), "graphite")
    m.sphere((0, 0.050, -0.045), 0.013, "uwi_blue", 6, 12, (1, 0.45, 1))
    m.sphere((0, 0.050, 0.005), 0.010, "mid", 6, 12, (1, 0.45, 1))
    m.sphere((0, 0.050, 0.045), 0.010, "mid", 6, 12, (1, 0.45, 1))
    m.box((0, 0.047, 0.075), (0.028, 0.006, 0.018), "dark")
    m.box((0, 0.047, -0.075), (0.035, 0.006, 0.018), "red")
    return m


def add_keyboard_keys(m: Model, start_x, start_z, columns, rows, spacing_x, spacing_z, y):
    for row in range(rows):
        for col in range(columns):
            width = spacing_x * (1.55 if row == rows - 1 and col == columns // 2 else 0.72)
            m.box(
                (start_x + col * spacing_x, y, start_z + row * spacing_z),
                (width, 0.006, spacing_z * 0.62),
                "dark",
            )


def model_laptop():
    m = Model("Professional Laptop")
    m.box((0, 0.025, 0.035), (0.32, 0.035, 0.22), "graphite")
    m.box((0, 0.046, 0.022), (0.292, 0.006, 0.172), "mid")
    add_keyboard_keys(m, -0.118, -0.03, 11, 4, 0.0235, 0.027, 0.052)
    m.box((0, 0.052, 0.078), (0.105, 0.004, 0.055), "dark")
    m.cylinder((0, 0.058, -0.083), 0.009, 0.29, "silver", (1, 0, 0), 14)
    m.box((0, 0.185, -0.095), (0.31, 0.255, 0.018), "graphite")
    m.box((0, 0.188, -0.105), (0.275, 0.215, 0.005), "dark")
    m.box((0, 0.188, -0.109), (0.255, 0.195, 0.003), "blue")
    m.sphere((0, 0.305, -0.112), 0.005, "dark", 4, 8)
    return m


def model_desktop_tower():
    m = Model("Desktop Tower")
    m.box((0, 0.185, 0), (0.19, 0.37, 0.34), "graphite")
    m.box((0, 0.185, 0.174), (0.165, 0.335, 0.008), "dark")
    m.cylinder((0, 0.195, 0.181), 0.058, 0.006, "mid", (0, 0, 1), 24)
    m.cylinder((0, 0.195, 0.185), 0.045, 0.004, "graphite", (0, 0, 1), 24)
    for angle in np.linspace(0, math.pi * 2, 8, endpoint=False):
        m.cylinder_between(
            (0, 0.195, 0.188),
            (0.041 * math.cos(angle), 0.195 + 0.041 * math.sin(angle), 0.188),
            0.004,
            "mid",
            8,
        )
    m.cylinder((-0.055, 0.315, 0.182), 0.011, 0.008, "uwi_blue", (0, 0, 1), 16)
    for x in (-0.025, 0.01, 0.045):
        m.box((x, 0.315, 0.182), (0.018, 0.008, 0.006), "silver")
    for x in (-0.065, 0.065):
        m.box((x, -0.005, 0), (0.035, 0.012, 0.25), "dark")
    return m


def model_all_in_one():
    m = Model("All-in-One Desktop")
    m.box((0, 0.285, 0), (0.42, 0.255, 0.028), "graphite")
    m.box((0, 0.292, 0.017), (0.385, 0.218, 0.007), "dark")
    m.box((0, 0.292, 0.022), (0.365, 0.198, 0.003), "light_blue")
    m.sphere((0, 0.405, 0.025), 0.005, "dark", 4, 8)
    m.cylinder((0, 0.115, -0.012), 0.017, 0.18, "silver", (0, 1, 0), 14)
    m.box((0, 0.025, -0.005), (0.23, 0.025, 0.14), "graphite")
    m.box((0, 0.042, 0.075), (0.29, 0.018, 0.085), "mid")
    return m


def model_desktop_speakers():
    m = Model("Desktop Speakers")
    for x in (-0.115, 0.115):
        m.box((x, 0.115, 0), (0.15, 0.23, 0.135), "graphite")
        m.box((x, 0.115, 0.071), (0.13, 0.205, 0.008), "dark")
        m.cylinder((x, 0.09, 0.078), 0.047, 0.008, "mid", (0, 0, 1), 24)
        m.cylinder((x, 0.09, 0.083), 0.023, 0.006, "graphite", (0, 0, 1), 20)
        m.cylinder((x, 0.175, 0.078), 0.024, 0.008, "silver", (0, 0, 1), 20)
        m.sphere((x + 0.046, 0.025, 0.084), 0.006, "uwi_blue", 4, 8)
    m.cylinder_between((-0.04, 0.02, -0.04), (0.04, 0.02, -0.04), 0.003, "dark", 8)
    return m


def model_laser_printer():
    m = Model("Desktop Laser Printer")
    m.box((0, 0.13, 0), (0.34, 0.26, 0.30), "offwhite")
    m.box((0, 0.272, -0.025), (0.28, 0.045, 0.22), "graphite")
    m.box((0, 0.30, -0.035), (0.23, 0.018, 0.155), "offwhite")
    m.box((0, 0.175, 0.153), (0.24, 0.075, 0.012), "dark")
    m.box((0.075, 0.247, 0.156), (0.085, 0.045, 0.008), "mid")
    m.box((0.075, 0.247, 0.161), (0.055, 0.025, 0.003), "light_blue")
    m.box((0, 0.045, 0.156), (0.26, 0.055, 0.012), "mid")
    return m


def model_multifunction_printer():
    m = Model("Multifunction Printer")
    m.box((0, 0.22, 0), (0.38, 0.44, 0.34), "offwhite")
    m.box((0, 0.455, -0.015), (0.41, 0.055, 0.31), "graphite")
    m.box((0, 0.488, -0.015), (0.365, 0.018, 0.275), "offwhite")
    m.box((0.09, 0.39, 0.17), (0.14, 0.085, 0.016), "graphite")
    m.box((0.09, 0.398, 0.179), (0.09, 0.047, 0.004), "light_blue")
    m.box((0, 0.26, 0.174), (0.25, 0.095, 0.012), "dark")
    m.box((0, 0.09, 0.174), (0.29, 0.09, 0.012), "mid")
    for y in (0.018, 0.205):
        for x in (-0.145, 0.145):
            m.cylinder((x, y, -0.12), 0.018, 0.035, "dark", (1, 0, 0), 12)
    return m


def model_projector():
    m = Model("Digital Projector")
    m.box((0, 0.07, 0), (0.31, 0.12, 0.25), "offwhite")
    m.box((-0.09, 0.075, 0.128), (0.095, 0.075, 0.012), "graphite")
    m.cylinder((-0.09, 0.075, 0.142), 0.036, 0.045, "silver", (0, 0, 1), 24)
    m.cylinder((-0.09, 0.075, 0.166), 0.026, 0.014, "dark", (0, 0, 1), 24)
    for x in np.linspace(0.015, 0.125, 6):
        m.box((x, 0.133, 0.02), (0.008, 0.004, 0.13), "dark")
    for x in (-0.11, 0.11):
        m.box((x, 0.004, 0), (0.035, 0.014, 0.15), "graphite")
    m.sphere((0.105, 0.135, 0.085), 0.006, "uwi_blue", 4, 8)
    return m


def model_wireless_mouse():
    m = Model("Wireless Mouse")
    m.sphere((0, 0.038, 0), 0.09, "graphite", 10, 24, (0.62, 0.43, 1.05))
    m.box((0, 0.075, -0.025), (0.004, 0.008, 0.085), "dark")
    m.cylinder((0, 0.082, -0.012), 0.008, 0.018, "silver", (1, 0, 0), 12)
    m.sphere((0, 0.064, 0.055), 0.005, "uwi_blue", 4, 8)
    return m


def model_wired_mouse():
    m = model_wireless_mouse()
    m.name = "Wired Optical Mouse"
    m.cylinder_between((0, 0.035, -0.09), (0, 0.025, -0.19), 0.003, "dark", 8)
    points = m.cable_loop((0, 0, -0.23), 0.055, 0.003, "dark", 0.72, 0.022, 0.008, 28)
    m.cylinder_between(points[-1], (0.10, 0.02, -0.27), 0.003, "dark", 8)
    add_usb_c_connector(m, (0.12, 0.02, -0.27), (1, 0, 0), "silver")
    return m


def model_keyboard():
    m = Model("Full-Size Keyboard")
    m.box((0, 0.025, 0), (0.45, 0.035, 0.17), "graphite")
    m.box((0, 0.046, -0.005), (0.425, 0.008, 0.145), "mid")
    add_keyboard_keys(m, -0.19, -0.055, 15, 5, 0.0265, 0.027, 0.052)
    for row in range(5):
        for col in range(3):
            m.box((0.153 + col * 0.022, 0.053, -0.055 + row * 0.027), (0.015, 0.006, 0.017), "dark")
    m.sphere((0.202, 0.054, 0.061), 0.004, "uwi_blue", 4, 8)
    return m


def model_monitor():
    m = Model("Office Monitor")
    m.box((0, 0.28, 0), (0.44, 0.265, 0.025), "graphite")
    m.box((0, 0.287, 0.016), (0.405, 0.23, 0.007), "dark")
    m.box((0, 0.287, 0.022), (0.385, 0.21, 0.003), "light_blue")
    m.cylinder((0, 0.115, -0.01), 0.017, 0.20, "silver", (0, 1, 0), 14)
    m.box((0, 0.022, 0), (0.25, 0.025, 0.15), "graphite")
    m.sphere((0.188, 0.147, 0.022), 0.004, "uwi_blue", 4, 8)
    return m


def model_docking_station():
    m = Model("Laptop Docking Station")
    m.box((0, 0.028, 0), (0.21, 0.045, 0.095), "graphite")
    m.box((0, 0.052, 0), (0.18, 0.005, 0.072), "mid")
    for x in (-0.065, -0.02, 0.025):
        m.box((x, 0.028, 0.049), (0.026, 0.014, 0.006), "silver")
    m.box((0.072, 0.028, 0.049), (0.041, 0.018, 0.006), "dark")
    m.sphere((0.083, 0.057, -0.025), 0.005, "uwi_blue", 4, 8)
    m.cylinder_between((-0.105, 0.028, 0), (-0.18, 0.022, -0.045), 0.0035, "dark", 8)
    add_usb_c_connector(m, (-0.20, 0.022, -0.055), (-1, 0, 0))
    return m


def model_webcam():
    m = Model("USB Webcam")
    m.box((0, 0.12, 0), (0.20, 0.08, 0.065), "graphite")
    m.cylinder((0, 0.12, 0.036), 0.025, 0.016, "silver", (0, 0, 1), 24)
    m.cylinder((0, 0.12, 0.047), 0.016, 0.012, "dark", (0, 0, 1), 24)
    for x in (-0.062, 0.062):
        m.sphere((x, 0.12, 0.037), 0.006, "mid", 4, 8)
    m.sphere((0.077, 0.145, 0.038), 0.004, "uwi_blue", 4, 8)
    m.cylinder((0, 0.07, 0), 0.013, 0.055, "silver", (0, 1, 0), 12)
    m.box((0, 0.025, 0), (0.16, 0.025, 0.11), "graphite")
    return m


def model_flatbed_scanner():
    m = Model("Flatbed Document Scanner")
    m.box((0, 0.055, 0), (0.36, 0.09, 0.29), "graphite")
    m.box((0, 0.108, -0.01), (0.345, 0.018, 0.26), "offwhite")
    m.box((0, 0.119, -0.01), (0.305, 0.006, 0.22), "light_blue")
    m.box((0, 0.131, -0.01), (0.34, 0.016, 0.26), "graphite")
    for x in (0.11, 0.135, 0.16):
        m.cylinder((x, 0.143, 0.095), 0.006, 0.005, "uwi_blue" if x == 0.16 else "mid", (0, 1, 0), 10)
    return m


def model_document_camera():
    m = Model("Document Camera")
    m.box((0, 0.022, 0), (0.24, 0.035, 0.19), "graphite")
    m.cylinder((0, 0.21, -0.045), 0.014, 0.38, "silver", (0, 1, 0), 12)
    m.cylinder_between((0, 0.39, -0.045), (0.12, 0.47, 0.02), 0.013, "silver", 12)
    m.box((0.14, 0.475, 0.03), (0.11, 0.055, 0.075), "graphite")
    m.cylinder((0.14, 0.448, 0.03), 0.019, 0.015, "dark", (0, 1, 0), 18)
    m.sphere((0.09, 0.485, 0.045), 0.005, "uwi_blue", 4, 8)
    return m


def model_usb_headset():
    m = Model("USB Office Headset")
    # Two upright headband rails make the silhouette immediately recognisable
    # from both the inventory thumbnail and the freely rotating 3D view.
    arc = np.linspace(0.06, math.pi - 0.06, 25)
    for z, radius, material in ((-0.017, 0.142, "graphite"), (0.017, 0.142, "graphite"), (0, 0.132, "mid")):
        points = [(radius * math.cos(angle), 0.125 + radius * math.sin(angle), z) for angle in arc]
        for a, b in zip(points, points[1:]):
            m.cylinder_between(a, b, 0.007 if z else 0.009, material, 10)

    # Adjustable metal yokes, oval earcup shells, and thick soft cushions.
    for x in (-0.145, 0.145):
        m.cylinder_between((x, 0.13, -0.017), (x, 0.092, -0.017), 0.006, "silver", 10)
        m.cylinder_between((x, 0.13, 0.017), (x, 0.092, 0.017), 0.006, "silver", 10)
        m.sphere((x, 0.083, 0), 0.052, "graphite", 8, 20, (0.46, 1.12, 0.90))
        m.cylinder((x - (0.014 if x < 0 else -0.014), 0.083, 0), 0.044, 0.020, "mid", (1, 0, 0), 22)
        m.torus((x - (0.027 if x < 0 else -0.027), 0.083, 0), 0.034, 0.009, "dark", (1, 0, 0), 24, 8)
        m.sphere((x - (0.039 if x < 0 else -0.039), 0.083, 0), 0.028, "dark", 6, 16, (0.24, 1.0, 0.82))

    # Articulated office boom microphone mounted to the left earcup.
    m.sphere((-0.17, 0.072, 0.015), 0.012, "silver", 5, 12)
    m.cylinder_between((-0.17, 0.072, 0.025), (-0.13, 0.045, 0.105), 0.005, "graphite", 10)
    m.cylinder_between((-0.13, 0.045, 0.105), (-0.075, 0.038, 0.135), 0.0045, "graphite", 10)
    m.sphere((-0.064, 0.037, 0.141), 0.013, "mid", 6, 12, (1.25, 0.82, 0.82))

    # USB lead and full-size USB-A plug distinguish it from wireless headphones.
    cable = [(0.16, 0.055, -0.02), (0.18, 0.005, -0.03), (0.20, -0.035, -0.065), (0.25, -0.055, -0.075)]
    for a, b in zip(cable, cable[1:]):
        m.cylinder_between(a, b, 0.0035, "dark", 8)
    m.box((0.273, -0.055, -0.075), (0.046, 0.021, 0.032), "graphite")
    m.box((0.307, -0.055, -0.075), (0.025, 0.015, 0.026), "silver")
    m.box((0.321, -0.055, -0.075), (0.005, 0.008, 0.017), "dark")
    return m


def model_wifi_router():
    m = Model("Wi-Fi Router")
    m.box((0, 0.035, 0), (0.28, 0.055, 0.18), "offwhite")
    m.box((0, 0.065, 0), (0.24, 0.006, 0.14), "mid")
    for x in (-0.11, 0.11):
        m.cylinder_between((x, 0.055, -0.07), (x, 0.28, -0.10), 0.006, "graphite", 10)
        m.sphere((x, 0.285, -0.101), 0.008, "graphite", 4, 8)
    for x in np.linspace(-0.07, 0.07, 5):
        m.sphere((x, 0.071, 0.055), 0.004, "uwi_blue", 4, 8)
    return m


def model_network_switch():
    m = Model("24-Port Network Switch")
    m.box((0, 0.04, 0), (0.44, 0.065, 0.22), "graphite")
    m.box((0, 0.04, 0.113), (0.42, 0.048, 0.006), "mid")
    for row in range(2):
        for col in range(12):
            x = -0.184 + col * 0.0335
            y = 0.027 + row * 0.027
            m.box((x, y, 0.118), (0.025, 0.018, 0.008), "dark")
            m.sphere((x + 0.008, y + 0.011, 0.123), 0.0025, "green", 3, 6)
    m.box((0.19, 0.04, 0.118), (0.034, 0.025, 0.008), "silver")
    return m


def model_access_point():
    m = Model("Wireless Access Point")
    m.sphere((0, 0.035, 0), 0.145, "offwhite", 10, 28, (1, 0.24, 1))
    m.sphere((0, 0.066, 0), 0.105, "white", 8, 24, (1, 0.18, 1))
    m.torus((0, 0.067, 0), 0.045, 0.004, "uwi_blue", (0, 1, 0), 28, 6)
    m.sphere((0, 0.073, 0), 0.012, "uwi_blue", 5, 10, (1, 0.25, 1))
    return m


def model_barcode_scanner():
    m = Model("Handheld Barcode Scanner")
    m.box((0, 0.245, 0), (0.12, 0.12, 0.16), "graphite", rotation_y=-0.18)
    m.box((0, 0.25, 0.083), (0.082, 0.065, 0.018), "dark", rotation_y=-0.18)
    m.box((0, 0.25, 0.094), (0.052, 0.036, 0.006), "red", rotation_y=-0.18)
    m.cylinder_between((0, 0.19, -0.02), (0.04, 0.05, -0.06), 0.035, "graphite", 14)
    m.box((0.043, 0.135, -0.045), (0.045, 0.055, 0.035), "uwi_blue", rotation_y=-0.18)
    m.box((0.04, 0.015, -0.06), (0.19, 0.025, 0.16), "mid")
    m.cylinder_between((0.04, 0.015, -0.13), (0.15, 0.015, -0.18), 0.003, "dark", 8)
    return m


BUILDERS: list[tuple[str, str, str, Callable[[], Model]]] = [
    ("laptop", "Professional Laptop", "Computers", model_laptop),
    ("desktop-tower", "Desktop Tower", "Computers", model_desktop_tower),
    ("all-in-one-desktop", "All-in-One Desktop", "Computers", model_all_in_one),
    ("desktop-speakers", "Desktop Speakers", "Audio", model_desktop_speakers),
    ("laser-printer", "Desktop Laser Printer", "Printing", model_laser_printer),
    ("multifunction-printer", "Multifunction Printer", "Printing", model_multifunction_printer),
    ("projector", "Digital Projector", "Classroom AV", model_projector),
    ("wireless-mouse", "Wireless Mouse", "Peripherals", model_wireless_mouse),
    ("wired-mouse", "Wired Optical Mouse", "Peripherals", model_wired_mouse),
    ("keyboard", "Full-Size Keyboard", "Peripherals", model_keyboard),
    ("monitor", "Office Monitor", "Displays", model_monitor),
    ("docking-station", "Laptop Docking Station", "Peripherals", model_docking_station),
    ("webcam", "USB Webcam", "Communications", model_webcam),
    ("flatbed-scanner", "Flatbed Document Scanner", "Imaging", model_flatbed_scanner),
    ("document-camera", "Document Camera", "Classroom AV", model_document_camera),
    ("usb-headset", "USB Office Headset", "Communications", model_usb_headset),
    ("wifi-router", "Wi-Fi Router", "Networking", model_wifi_router),
    ("network-switch", "24-Port Network Switch", "Networking", model_network_switch),
    ("wireless-access-point", "Wireless Access Point", "Networking", model_access_point),
    ("barcode-scanner", "Handheld Barcode Scanner", "Inventory tools", model_barcode_scanner),
]


def align4(data: bytearray):
    while len(data) % 4:
        data.append(0)


def export_glb(model: Model, path: Path):
    binary = bytearray()
    buffer_views = []
    accessors = []
    primitives = []
    materials = []
    material_index = {}

    for name in model.groups:
        rgba = PALETTE[name]
        metallic, roughness = MATERIAL_PROPERTIES.get(name, (0.08, 0.62))
        material_index[name] = len(materials)
        materials.append(
            {
                "name": name,
                "pbrMetallicRoughness": {
                    "baseColorFactor": list(rgba),
                    "metallicFactor": metallic,
                    "roughnessFactor": roughness,
                },
                "doubleSided": False,
            }
        )

    def add_view(raw: bytes, target: int):
        align4(binary)
        offset = len(binary)
        binary.extend(raw)
        idx = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(raw), "target": target})
        return idx

    for material, geometry in model.groups.items():
        pos = np.asarray(geometry.positions, dtype="<f4")
        norm = np.asarray(geometry.normals, dtype="<f4")
        ind = np.asarray(geometry.indices, dtype="<u4")
        pv = add_view(pos.tobytes(), 34962)
        nv = add_view(norm.tobytes(), 34962)
        iv = add_view(ind.tobytes(), 34963)
        pa = len(accessors)
        accessors.append(
            {
                "bufferView": pv, "componentType": 5126, "count": len(pos), "type": "VEC3",
                "min": pos.min(axis=0).tolist(), "max": pos.max(axis=0).tolist(),
            }
        )
        na = len(accessors)
        accessors.append({"bufferView": nv, "componentType": 5126, "count": len(norm), "type": "VEC3"})
        ia = len(accessors)
        accessors.append({"bufferView": iv, "componentType": 5125, "count": len(ind), "type": "SCALAR"})
        primitives.append(
            {
                "attributes": {"POSITION": pa, "NORMAL": na},
                "indices": ia,
                "material": material_index[material],
                "mode": 4,
            }
        )

    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "OpenAI procedural low-poly asset generator",
            "extras": {"units": "meters", "license": "Created for the University IT Inventory System"},
        },
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": model.name}],
        "meshes": [{"name": model.name, "primitives": primitives}],
        "materials": materials,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(binary)}],
    }
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    while len(json_bytes) % 4:
        json_bytes += b" "
    align4(binary)
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    with path.open("wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(json_bytes), b"JSON"))
        f.write(json_bytes)
        f.write(struct.pack("<I4s", len(binary), b"BIN\x00"))
        f.write(binary)


def render_preview(model: Model, path: Path, label: str, size=620):
    triangles = []
    all_points = []
    ry, rx = math.radians(-36), math.radians(24)
    cy, sy = math.cos(ry), math.sin(ry)
    cx, sx = math.cos(rx), math.sin(rx)
    rot_y = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rot_x = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    rotation = rot_x @ rot_y
    light = np.array([-0.45, 0.8, 0.45])
    light /= np.linalg.norm(light)
    for material, geometry in model.groups.items():
        positions = np.asarray(geometry.positions)
        transformed = positions @ rotation.T
        color = np.asarray(PALETTE[material][:3]) * 255
        for i in range(0, len(geometry.indices), 3):
            ids = geometry.indices[i:i + 3]
            pts = transformed[ids]
            normal = np.cross(pts[1] - pts[0], pts[2] - pts[0])
            length = np.linalg.norm(normal)
            normal = normal / length if length else normal
            shade = 0.55 + 0.45 * max(0, float(np.dot(normal, light)))
            rgb = tuple(np.clip(color * shade, 0, 255).astype(int))
            triangles.append((float(pts[:, 2].mean()), pts, rgb))
            all_points.extend(pts[:, :2].tolist())
    all_points = np.asarray(all_points)
    minimum, maximum = all_points.min(axis=0), all_points.max(axis=0)
    extent = np.maximum(maximum - minimum, 1e-5)
    scale = min((size - 100) / extent[0], (size - 145) / extent[1])
    center = (minimum + maximum) / 2
    canvas = Image.new("RGB", (size, size), (238, 239, 240))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.ellipse((size * 0.23, size * 0.76, size * 0.77, size * 0.86), fill=(20, 28, 34, 32))
    triangles.sort(key=lambda x: x[0])
    for _, pts, rgb in triangles:
        coords = []
        for p in pts:
            x = (p[0] - center[0]) * scale + size / 2
            y = size * 0.48 - (p[1] - center[1]) * scale
            coords.append((float(x), float(y)))
        draw.polygon(coords, fill=(*rgb, 255), outline=(22, 29, 34, 80))
    draw.rectangle((0, size - 78, size, size), fill=(29, 31, 32, 245))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
        small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    except OSError:
        font = ImageFont.load_default()
        small = font
    draw.text((24, size - 61), label, fill=(244, 245, 246), font=font)
    draw.text((24, size - 30), "LOW-POLY GLB · METRE SCALE", fill=(137, 171, 202), font=small)
    canvas.save(path, quality=92)


def main():
    manifest = []
    for slug, label, category, builder in BUILDERS:
        model = builder()
        low, high = model.bounds()
        export_glb(model, MODELS_DIR / f"{slug}.glb")
        render_preview(model, PREVIEWS_DIR / f"{slug}.png", label)
        triangles = sum(len(g.indices) // 3 for g in model.groups.values())
        manifest.append(
            {
                "id": slug,
                "name": label,
                "category": category,
                "file": f"models/{slug}.glb",
                "preview": f"previews/{slug}.png",
                "dimensions_m": {
                    "width": round(float(high[0] - low[0]), 3),
                    "height": round(float(high[1] - low[1]), 3),
                    "depth": round(float(high[2] - low[2]), 3),
                },
                "triangles": triangles,
                "format": "glTF Binary 2.0",
                "up_axis": "Y",
            }
        )
        print(f"{slug:28} {triangles:6} triangles")
    (ROOT / "manifest.json").write_text(json.dumps({"version": 1, "units": "meters", "models": manifest}, indent=2))

    thumb_size = 280
    rows = math.ceil(len(manifest) / 4)
    sheet = Image.new("RGB", (thumb_size * 4, thumb_size * rows), (226, 227, 228))
    for i, item in enumerate(manifest):
        image = Image.open(ROOT / item["preview"]).resize((thumb_size, thumb_size))
        sheet.paste(image, ((i % 4) * thumb_size, (i // 4) * thumb_size))
    sheet.save(ROOT / "contact-sheet.jpg", quality=91)

    # Validate GLB headers and declared lengths.
    for item in manifest:
        path = ROOT / item["file"]
        data = path.read_bytes()
        magic, version, total = struct.unpack("<4sII", data[:12])
        assert magic == b"glTF" and version == 2 and total == len(data)
    print(f"Generated and validated {len(manifest)} GLB models.")


if __name__ == "__main__":
    main()
