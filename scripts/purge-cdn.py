#!/usr/bin/env python3
import os
from pathlib import Path

from tencentcloud.common import credential
from tencentcloud.cdn.v20180606 import cdn_client, models


PURGE_URLS = [
    "https://storage.txyun.investoday.net/application/skill-store/packages/investoday-finance-data/investoday-finance-data.zip",
    "https://storage.txyun.investoday.net/application/skill-store/configs/investoday-api.manifest.json",
]


def main():
    cred = credential.Credential(os.environ["COS_SECRET_ID"], os.environ["COS_SECRET_KEY"])
    client = cdn_client.CdnClient(cred, "")
    request = models.PurgeUrlsCacheRequest()
    request.Urls = PURGE_URLS
    response = client.PurgeUrlsCache(request)
    print(f"CDN purge submitted: {response.TaskId}")

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with Path(summary_path).open("a") as summary:
            summary.write(f"\n## CDN purge\n\n- taskId: `{response.TaskId}`\n")
            for url in request.Urls:
                summary.write(f"- `{url}`\n")


if __name__ == "__main__":
    main()
