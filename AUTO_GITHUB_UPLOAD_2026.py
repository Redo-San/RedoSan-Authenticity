#!/usr/bin/env python3
"""
🚀 Automatic GitHub Upload Script for 2026
Advanced automation for GitHub publishing with AI-powered solutions
"""

import os
import subprocess
import time
import json
import requests
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import threading
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AutoGitHubUploader:
    """Advanced automatic GitHub uploader with 2026 AI capabilities"""
    
    def __init__(self, repo_path, github_token, repo_name, username="Redo-San"):
        self.repo_path = Path(repo_path)
        self.github_token = github_token
        self.repo_name = repo_name
        self.username = username
        self.api_url = f"https://api.github.com/repos/{username}/{repo_name}"
        self.observer = None
        self.is_running = False
        
    def setup_github_auth(self):
        """Setup GitHub authentication using token"""
        logger.info("Setting up GitHub authentication...")
        
        # Configure git with token
        os.chdir(self.repo_path)
        
        # Remove existing remote if any
        subprocess.run(["git", "remote", "remove", "origin"], capture_output=True)
        
        # Add remote with token authentication
        remote_url = f"https://{self.username}:{self.github_token}@github.com/{self.username}/{self.repo_name}.git"
        result = subprocess.run(["git", "remote", "add", "origin", remote_url], capture_output=True, text=True)
        
        if result.returncode == 0:
            logger.info("✅ GitHub authentication setup successful")
            return True
        else:
            logger.error(f"❌ Failed to setup GitHub auth: {result.stderr}")
            return False
    
    def create_repository_if_not_exists(self):
        """Create repository if it doesn't exist using GitHub API"""
        logger.info("Checking if repository exists...")
        
        headers = {
            "Authorization": f"token {self.github_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        # Check if repository exists
        response = requests.get(self.api_url, headers=headers)
        
        if response.status_code == 200:
            logger.info("✅ Repository already exists")
            return True
        elif response.status_code == 404:
            # Create repository
            logger.info("📝 Creating new repository...")
            
            create_data = {
                "name": self.repo_name,
                "description": "Steganography + OpenTimestamps + C2PA - Advanced Data Authenticity Tool",
                "private": False,
                "auto_init": True
            }
            
            create_response = requests.post("https://api.github.com/user/repos", 
                                          headers=headers, 
                                          json=create_data)
            
            if create_response.status_code == 201:
                logger.info("✅ Repository created successfully")
                return True
            else:
                logger.error(f"❌ Failed to create repository: {create_response.text}")
                return False
        else:
            logger.error(f"❌ Error checking repository: {response.text}")
            return False
    
    def initialize_git_if_needed(self):
        """Initialize git repository if not already done"""
        logger.info("Checking git repository status...")
        
        if not (self.repo_path / ".git").exists():
            logger.info("📝 Initializing git repository...")
            os.chdir(self.repo_path)
            
            # Initialize git
            subprocess.run(["git", "init"], capture_output=True)
            
            # Configure user
            subprocess.run(["git", "config", "user.name", "Redo-San"], capture_output=True)
            subprocess.run(["git", "config", "user.email", "redo-san@users.noreply.github.com"], capture_output=True)
            
            # Add all files
            subprocess.run(["git", "add", "."], capture_output=True)
            
            # Initial commit
            subprocess.run(["git", "commit", "-m", "🚀 Initial commit - RedoSan Authenticity v1.0.0"], capture_output=True)
            
            logger.info("✅ Git repository initialized")
            return True
        else:
            logger.info("✅ Git repository already exists")
            return True
    
    def commit_and_push_changes(self, message="🔄 Auto-sync update"):
        """Commit and push changes to GitHub"""
        logger.info("🔄 Committing and pushing changes...")
        
        os.chdir(self.repo_path)
        
        try:
            # Add all changes
            subprocess.run(["git", "add", "."], capture_output=True, check=True)
            
            # Check if there are changes to commit
            status_result = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
            
            if status_result.stdout.strip():
                # Commit changes
                subprocess.run(["git", "commit", "-m", message], capture_output=True, check=True)
                
                # Push to GitHub
                push_result = subprocess.run(["git", "push", "origin", "main"], capture_output=True, text=True)
                
                if push_result.returncode == 0:
                    logger.info("✅ Changes pushed successfully")
                    return True
                else:
                    # Try force push if regular push fails
                    logger.warning("⚠️ Regular push failed, trying force push...")
                    force_push_result = subprocess.run(["git", "push", "origin", "main", "--force"], capture_output=True, text=True)
                    
                    if force_push_result.returncode == 0:
                        logger.info("✅ Force push successful")
                        return True
                    else:
                        logger.error(f"❌ Force push failed: {force_push_result.stderr}")
                        return False
            else:
                logger.info("ℹ️ No changes to commit")
                return True
                
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Git operation failed: {e}")
            return False
    
    def create_release(self, tag="v1.0.0-beta", name="Beta Release v1.0.0"):
        """Create a GitHub release"""
        logger.info(f"🏷️ Creating release: {tag}")
        
        headers = {
            "Authorization": f"token {self.github_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        # Create tag if it doesn't exist
        tag_data = {
            "tag": tag,
            "message": f"Release {tag}",
            "type": "commit",
            "target": "main"
        }
        
        tag_response = requests.post(f"{self.api_url}/git/refs/tags", headers=headers, json=tag_data)
        
        # Create release
        release_data = {
            "tag_name": tag,
            "name": name,
            "body": """🚀 **RedoSan Authenticity Beta Release v1.0.0**

## 📋 **New Features:**
- ✅ Advanced data persistence system with StringVar and trace_add
- ✅ Automatic save functionality for all content types
- ✅ Manual save button as backup
- ✅ Separate data files for each content type
- ✅ Comprehensive testing and validation
- ✅ Steganography integration
- ✅ OpenTimestamps support
- ✅ C2PA metadata handling

## 🔧 **Technical Improvements:**
- Enhanced data synchronization
- Improved error handling
- Better user experience
- Robust file management

## 🎯 **Usage:**
1. Run `main.py` to start the application
2. Add your content in the respective fields
3. Data is automatically saved
4. Use manual save button for additional security

## 📞 **Support:**
- Issues: GitHub repository issues
- Documentation: Included in repository
- Community: GitHub discussions

---
🔐 *RedoSan Authenticity - Advanced Data Authenticity Tool*""",
            "draft": False,
            "prerelease": True
        }
        
        release_response = requests.post(f"{self.api_url}/releases", headers=headers, json=release_data)
        
        if release_response.status_code == 201:
            logger.info("✅ Release created successfully")
            return True
        else:
            logger.error(f"❌ Failed to create release: {release_response.text}")
            return False
    
    def start_auto_sync(self, interval=30):
        """Start automatic synchronization"""
        logger.info(f"🔄 Starting auto-sync with {interval}s interval...")
        
        def sync_loop():
            while self.is_running:
                try:
                    self.commit_and_push_changes()
                    time.sleep(interval)
                except Exception as e:
                    logger.error(f"❌ Auto-sync error: {e}")
                    time.sleep(interval)
        
        self.is_running = True
        sync_thread = threading.Thread(target=sync_loop, daemon=True)
        sync_thread.start()
        
        logger.info("✅ Auto-sync started")
        return True
    
    def stop_auto_sync(self):
        """Stop automatic synchronization"""
        self.is_running = False
        logger.info("⏹️ Auto-sync stopped")
    
    def monitor_file_changes(self):
        """Monitor file changes and auto-sync"""
        logger.info("👁️ Starting file change monitoring...")
        
        class ChangeHandler(FileSystemEventHandler):
            def __init__(self, uploader):
                self.uploader = uploader
                self.last_sync = time.time()
                
            def on_modified(self, event):
                if not event.is_directory:
                    # Wait a bit to avoid multiple syncs
                    if time.time() - self.last_sync > 5:
                        logger.info(f"📝 File changed: {event.src_path}")
                        self.uploader.commit_and_push_changes(f"🔄 Auto-sync: {Path(event.src_path).name} updated")
                        self.last_sync = time.time()
        
        event_handler = ChangeHandler(self)
        self.observer = Observer()
        self.observer.schedule(event_handler, str(self.repo_path), recursive=True)
        self.observer.start()
        
        logger.info("✅ File monitoring started")
        return True
    
    def stop_monitoring(self):
        """Stop file monitoring"""
        if self.observer:
            self.observer.stop()
            self.observer.join()
            logger.info("⏹️ File monitoring stopped")
    
    def full_setup_and_publish(self):
        """Complete setup and publishing process"""
        logger.info("🚀 Starting full setup and publishing process...")
        
        steps = [
            ("Initialize Git", self.initialize_git_if_needed),
            ("Setup GitHub Auth", self.setup_github_auth),
            ("Create Repository", self.create_repository_if_not_exists),
            ("Push Initial Code", lambda: self.commit_and_push_changes("🚀 Initial commit - RedoSan Authenticity")),
            ("Create Beta Release", lambda: self.create_release()),
        ]
        
        for step_name, step_func in steps:
            logger.info(f"📋 Step: {step_name}")
            if not step_func():
                logger.error(f"❌ Failed at step: {step_name}")
                return False
            time.sleep(1)  # Brief pause between steps
        
        logger.info("🎉 Full setup and publishing completed successfully!")
        return True

def main():
    """Main execution function"""
    print("🚀 RedoSan Authenticity - Automatic GitHub Publisher 2026")
    print("=" * 60)
    
    # Configuration
    repo_path = r"f:\RedoSan Authenticity"
    repo_name = "RedoSan-Authenticity"
    username = "Redo-San"
    
    # Get GitHub token (you should set this as environment variable)
    github_token = os.getenv("GITHUB_TOKEN")
    if not github_token:
        print("❌ Please set GITHUB_TOKEN environment variable")
        print("📝 Get your token from: https://github.com/settings/tokens")
        return False
    
    # Create uploader instance
    uploader = AutoGitHubUploader(repo_path, github_token, repo_name, username)
    
    # Perform full setup and publishing
    if uploader.full_setup_and_publish():
        print("\n🎉 SUCCESS! Project published to GitHub!")
        print(f"📋 Repository: https://github.com/{username}/{repo_name}")
        print(f"🏷️ Release: https://github.com/{username}/{repo_name}/releases")
        
        # Start auto-sync (optional)
        print("\n🔄 Starting auto-sync for future changes...")
        uploader.start_auto_sync(interval=60)  # Sync every minute
        
        # Start file monitoring (optional)
        uploader.monitor_file_changes()
        
        print("\n✅ Auto-sync and file monitoring are active!")
        print("📝 Press Ctrl+C to stop...")
        
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n⏹️ Stopping auto-sync...")
            uploader.stop_auto_sync()
            uploader.stop_monitoring()
            print("✅ Stopped successfully")
        
        return True
    else:
        print("❌ Failed to publish project")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
