"""
Watermark module facade for RedoSan Authenticity
Provides unified interface to all watermarking functionality.
"""
from .watermark_types import *

__all__ = [
    'WATERMARK_TYPES',
    'embed',
    'extract',
    'list_watermarks',
    'describe_watermark'
]
