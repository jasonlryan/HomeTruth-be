#!/usr/bin/env python3
"""
Slack notification script for GitHub Actions CI/CD pipeline.
Sends notifications for build start, success, and failure events.
"""

import os
import sys
import json
import requests
from datetime import datetime
from zoneinfo import ZoneInfo


def send_slack_notification(webhook_url, status, repo_name, branch, commit_message, author, run_url):
    """
    Send a notification to Slack with build status.
    
    Args:
        webhook_url: Slack webhook URL
        status: Build status (started, success, failed)
        repo_name: Repository name
        branch: Git branch name
        commit_message: Latest commit message
        author: Commit author
        run_url: GitHub Actions run URL
    """
    
    # Define colors and emojis for different statuses######
    status_config = {
        "started": {
            "color": "#FFA500",
            "emoji": "🚀",
            "title": "Build Started"
        },
        "success": {
            "color": "#36a64f",
            "emoji": "✅",
            "title": "Build Successful"
        },
        "failed": {
            "color": "#ff0000",
            "emoji": "❌",
            "title": "Build Failed"
        }
    }
    
    config = status_config.get(status, status_config["started"])
    
    # Use Jordan timezone (Asia/Amman)
    jordan_tz = ZoneInfo("Asia/Amman")
    timestamp = datetime.now(jordan_tz).strftime("%Y-%m-%d %H:%M:%S")
    timezone_name = datetime.now(jordan_tz).strftime("%Z")
    
    # Build Slack message payload
    payload = {
        "attachments": [
            {
                "color": config["color"],
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": f"{config['emoji']} {config['title']}",
                            "emoji": True
                        }
                    },
                    {
                        "type": "section",
                        "fields": [
                            {
                                "type": "mrkdwn",
                                "text": f"*Repository:*\n{repo_name}"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Branch:*\n`{branch}`"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Author:*\n{author}"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Status:*\n{status.upper()}"
                            }
                        ]
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Commit Message:*\n{commit_message}"
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"<{run_url}|View Workflow Run>"
                        }
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": f"⏰ {timestamp} (Jordan Time)"
                            }
                        ]
                    }
                ]
            }
        ]
    }
    
    try:
        response = requests.post(
            webhook_url,
            data=json.dumps(payload),
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        response.raise_for_status()
        print(f"✓ Slack notification sent successfully: {status}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"✗ Error sending Slack notification: {e}", file=sys.stderr)
        return False


def main():
    """Main function to send Slack notification based on environment variables."""
    
    # Get environment variables from GitHub Actions
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    status = os.getenv("BUILD_STATUS", "started")
    repo_name = os.getenv("GITHUB_REPOSITORY", "Unknown Repository")
    branch = os.getenv("GITHUB_REF", "").replace("refs/heads/", "")
    commit_message = os.getenv("COMMIT_MESSAGE", "No commit message")
    author = os.getenv("GITHUB_ACTOR", "Unknown")
    run_url = f"https://github.com/{repo_name}/actions/runs/{os.getenv('GITHUB_RUN_ID', '')}"
    
    # Validate webhook URL
    if not webhook_url:
        print("Error: SLACK_WEBHOOK_URL environment variable is not set", file=sys.stderr)
        sys.exit(1)
    
    # Send notification
    success = send_slack_notification(
        webhook_url=webhook_url,
        status=status,
        repo_name=repo_name,
        branch=branch,
        commit_message=commit_message,
        author=author,
        run_url=run_url
    )
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
