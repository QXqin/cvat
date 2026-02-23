import requests
import sys

def download_file_from_google_drive(id, destination):
    URL = "https://docs.google.com/uc?export=download"

    session = requests.Session()
    session.proxies = {"http": "http://127.0.0.1:7890", "https": "http://127.0.0.1:7890"}

    try:
        response = session.get(URL, params={"id": id}, stream=True)
        token = get_confirm_token(response)

        if token:
            params = {"id": id, "confirm": token}
            response = session.get(URL, params=params, stream=True)

        save_response_content(response, destination)
        print("Download successful.")
    except Exception as e:
        print(f"Error downloading: {e}")
        # Try without explicit proxies
        print("Retrying without explicit proxy...")
        session.proxies = {}
        try:
            response = session.get(URL, params={"id": id}, stream=True)
            token = get_confirm_token(response)
            if token:
                params = {"id": id, "confirm": token}
                response = session.get(URL, params=params, stream=True)
            save_response_content(response, destination)
            print("Download successful.")
        except Exception as e2:
            print(f"Failed again: {e2}")

def get_confirm_token(response):
    for key, value in response.cookies.items():
        if key.startswith("download_warning"):
            return value
    return None

def save_response_content(response, destination):
    CHUNK_SIZE = 32768
    with open(destination, "wb") as f:
        for chunk in response.iter_content(CHUNK_SIZE):
            if chunk:
                f.write(chunk)

if __name__ == "__main__":
    file_id = "1Pq0sK-9jmbLAVtgB9-dPDc2pipCxYdM5"
    destination = r"E:\@WorkSpace\cvat\serverless\pytorch\dschoerk\transt\nuclio\transt.pth"
    download_file_from_google_drive(file_id, destination)
