# Copyright (C) 2026 CVAT Relation Tool Contributors
# SPDX-License-Identifier: MIT

"""
Utility script to download the nuctl binary for serverless deployment.
Supports resuming and proxy configuration via CLI arguments.
"""

import argparse
import os
import sys
import requests
from typing import Optional

def download_file(url: str, destination: str, proxy: Optional[str] = None) -> None:
    """
    Download a file from a URL to a local destination.

    Args:
        url: URL of the file to download.
        destination: Local path where the file should be saved.
        proxy: Optional HTTP/HTTPS proxy (e.g., 'http://127.0.0.1:7890').
    """
    session = requests.Session()
    if proxy:
        session.proxies = {"http": proxy, "https": proxy}

    # Ensure destination directory exists
    os.makedirs(os.path.dirname(os.path.abspath(destination)), exist_ok=True)

    try:
        print(f"Downloading {url} to {destination}...")
        response = session.get(url, stream=True)
        response.raise_for_status()
        with open(destination, "wb") as f:
            for chunk in response.iter_content(32768):
                if chunk:
                    f.write(chunk)
        print("Download successful.")
    except Exception as e:
        print(f"Error downloading: {e}")
        if proxy:
            print("Retrying without proxy...")
            session.proxies = {}
            try:
                response = session.get(url, stream=True)
                response.raise_for_status()
                with open(destination, "wb") as f:
                    for chunk in response.iter_content(32768):
                        if chunk:
                            f.write(chunk)
                print("Download successful.")
            except Exception as e2:
                print(f"Failed again: {e2}")
                sys.exit(1)
        else:
            sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download nuctl binary for CVAT serverless deployment.")
    parser.add_argument("--url", default="https://github.com/nuclio/nuclio/releases/download/1.15.9/nuctl-1.15.9-linux-amd64",
                        help="URL of the nuctl binary to download.")
    parser.add_argument("--dest", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "nuctl"),
                        help="Destination path for the downloaded binary.")
    parser.add_argument("--proxy", default=None,
                        help="HTTP/HTTPS proxy URL (e.g., http://127.0.0.1:7890).")

    args = parser.parse_args()
    download_file(args.url, args.dest, args.proxy)
