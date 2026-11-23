#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Compute real heading pages for the Lab-2 report and verify ЗМІСТ stability."""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib.util

spec = importlib.util.spec_from_file_location("genlab2", os.path.join(HERE, "gen-lab2.py"))
genlab2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(genlab2)

PDF = "/home/wired/Documents/poly/AIIP-LAB2_Volchenko_PZIP-11_звіт.pdf"
TXT = "/tmp/lab2-report.txt"
PAGES_JSON = os.path.join(HERE, "pages-lab2.json")


def norm(s):
    s = s.replace("\u00ad", "")
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def page_texts():
    subprocess.run(["pdftotext", "-layout", PDF, TXT], check=True)
    with open(TXT, encoding="utf-8") as f:
        raw = f.read()
    pages = raw.split("\f")
    if pages and not pages[-1].strip():
        pages = pages[:-1]
    return [norm(p) for p in pages]


def find_pages(pages):
    found = {}
    misses = []
    for level, text in genlab2.TOC_ITEMS:
        needle = norm(text)
        hit = None
        for i, page in enumerate(pages, start=1):
            if i <= 2:          # title page + ЗМІСТ
                continue
            if needle in page:
                hit = i
                break
        if hit is None:
            misses.append(text)
        else:
            found[text] = hit
    return found, misses


def main():
    pages = page_texts()
    found, misses = find_pages(pages)
    old = {}
    if os.path.exists(PAGES_JSON):
        old = json.load(open(PAGES_JSON, encoding="utf-8"))
    print("pdf pages:", len(pages))
    print("headings found: %d/%d" % (len(found), len(genlab2.TOC_ITEMS)))
    if misses:
        print("MISSING:", misses)
    for level, text in genlab2.TOC_ITEMS:
        mark = ""
        if text in found and text in old:
            mark = "ok" if old[text] == found[text] else "SHIFT %s -> %s" % (old[text], found[text])
        print("  %-52s %s  %s" % (text, found.get(text, "?"), mark))
    json.dump(found, open(PAGES_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("wrote", PAGES_JSON)


if __name__ == "__main__":
    main()
