import requests

def download_file(url, destination):
    session = requests.Session()
    session.proxies = {"http": "http://127.0.0.1:7890", "https": "http://127.0.0.1:7890"}

    try:
        response = session.get(url, stream=True)
        response.raise_for_status()
        with open(destination, "wb") as f:
            for chunk in response.iter_content(32768):
                if chunk:
                    f.write(chunk)
        print("Download successful.")
    except Exception as e:
        print(f"Error downloading: {e}")
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

if __name__ == "__main__":
    url = "https://github.com/nuclio/nuclio/releases/download/1.15.9/nuctl-1.15.9-linux-amd64"
    dest = r"E:\@WorkSpace\cvat\serverless\nuctl"
    download_file(url, dest)
