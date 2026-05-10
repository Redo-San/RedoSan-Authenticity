#!/usr/bin/env python3
"""
🚀 Simple Automatic GitHub Upload Script
No external dependencies required - just Python standard library
"""

import os
import subprocess
import json
import urllib.request
import urllib.parse
import base64
import time

class SimpleGitHubUploader:
    def __init__(self, repo_path, github_token, repo_name, username="Redo-San"):
        self.repo_path = repo_path
        self.github_token = github_token
        self.repo_name = repo_name
        self.username = username
        self.api_url = f"https://api.github.com/repos/{username}/{repo_name}"
        
    def create_repository_if_not_exists(self):
        """Create repository using GitHub API"""
        print("📋 Checking if repository exists...")
        
        # Check if repository exists
        try:
            url = f"https://api.github.com/repos/{self.username}/{self.repo_name}"
            req = urllib.request.Request(url)
            req.add_header('Authorization', f'token {self.github_token}')
            req.add_header('User-Agent', 'RedoSan-AutoUploader')
            
            with urllib.request.urlopen(req) as response:
                if response.status == 200:
                    print("✅ Repository already exists")
                    return True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                # Create repository
                print("📝 Creating new repository...")
                
                create_data = {
                    "name": self.repo_name,
                    "description": "Steganography + OpenTimestamps + C2PA - Advanced Data Authenticity Tool",
                    "private": False,
                    "auto_init": True
                }
                
                url = "https://api.github.com/user/repos"
                req = urllib.request.Request(url)
                req.add_header('Authorization', f'token {self.github_token}')
                req.add_header('User-Agent', 'RedoSan-AutoUploader')
                req.add_header('Content-Type', 'application/json')
                
                data = json.dumps(create_data).encode('utf-8')
                
                try:
                    with urllib.request.urlopen(req, data) as response:
                        if response.status == 201:
                            print("✅ Repository created successfully")
                            time.sleep(2)  # Wait for repo to be ready
                            return True
                        else:
                            print(f"❌ Failed to create repository: {response.status}")
                            return False
                except Exception as e:
                    print(f"❌ Failed to create repository: {e}")
                    return False
            else:
                print(f"❌ Error checking repository: {e}")
                return False
        except Exception as e:
            print(f"❌ Error checking repository: {e}")
            return False
    
    def initialize_git_if_needed(self):
        """Initialize git repository"""
        print("📋 Checking git repository...")
        
        if not os.path.exists(os.path.join(self.repo_path, ".git")):
            print("📝 Initializing git repository...")
            
            os.chdir(self.repo_path)
            
            # Initialize git
            subprocess.run(["git", "init"], capture_output=True)
            
            # Configure user
            subprocess.run(["git", "config", "user.name", "Redo-San"], capture_output=True)
            subprocess.run(["git", "config", "user.email", "redo-san@users.noreply.github.com"], capture_output=True)
            
            print("✅ Git repository initialized")
            return True
        else:
            print("✅ Git repository already exists")
            return True
    
    def setup_remote_and_push(self):
        """Setup remote and push files"""
        print("🔄 Setting up remote and pushing files...")
        
        os.chdir(self.repo_path)
        
        # Remove existing remote if any
        subprocess.run(["git", "remote", "remove", "origin"], capture_output=True)
        
        # Add remote with token authentication
        remote_url = f"https://{self.username}:{self.github_token}@github.com/{self.username}/{self.repo_name}.git"
        result = subprocess.run(["git", "remote", "add", "origin", remote_url], capture_output=True)
        
        if result.returncode != 0:
            print("❌ Failed to add remote")
            return False
        
        # Add all files
        subprocess.run(["git", "add", "."], capture_output=True)
        
        # Check if there are changes
        status_result = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
        
        if status_result.stdout.strip():
            # Commit changes
            commit_result = subprocess.run(["git", "commit", "-m", "🚀 Initial commit - RedoSan Authenticity v1.0.0"], capture_output=True)
            
            if commit_result.returncode != 0:
                print("❌ Failed to commit changes")
                return False
        else:
            print("ℹ️ No changes to commit")
        
        # Push to GitHub
        print("📤 Pushing to GitHub...")
        push_result = subprocess.run(["git", "push", "origin", "main"], capture_output=True, text=True)
        
        if push_result.returncode == 0:
            print("✅ Files pushed successfully")
            return True
        else:
            # Try with master branch
            print("⚠️ Trying with master branch...")
            push_result = subprocess.run(["git", "push", "origin", "master"], capture_output=True, text=True)
            
            if push_result.returncode == 0:
                print("✅ Files pushed successfully (master branch)")
                return True
            else:
                # Try force push
                print("⚠️ Trying force push...")
                force_push_result = subprocess.run(["git", "push", "origin", "main", "--force"], capture_output=True, text=True)
                
                if force_push_result.returncode == 0:
                    print("✅ Force push successful")
                    return True
                else:
                    print(f"❌ Failed to push: {force_push_result.stderr}")
                    return False
    
    def create_release(self):
        """Create a GitHub release"""
        print("🏷️ Creating release...")
        
        release_data = {
            "tag_name": "v1.0.0-beta",
            "name": "Beta Release v1.0.0",
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
        
        url = f"{self.api_url}/releases"
        req = urllib.request.Request(url)
        req.add_header('Authorization', f'token {self.github_token}')
        req.add_header('User-Agent', 'RedoSan-AutoUploader')
        req.add_header('Content-Type', 'application/json')
        
        data = json.dumps(release_data).encode('utf-8')
        
        try:
            with urllib.request.urlopen(req, data) as response:
                if response.status == 201:
                    print("✅ Release created successfully")
                    return True
                else:
                    print(f"❌ Failed to create release: {response.status}")
                    return False
        except Exception as e:
            print(f"❌ Failed to create release: {e}")
            return False
    
    def full_setup_and_publish(self):
        """Complete setup and publishing process"""
        print("🚀 Starting automatic GitHub publishing...")
        print("=" * 50)
        
        steps = [
            ("Initialize Git", self.initialize_git_if_needed),
            ("Create Repository", self.create_repository_if_not_exists),
            ("Setup Remote and Push", self.setup_remote_and_push),
            ("Create Release", self.create_release),
        ]
        
        for step_name, step_func in steps:
            print(f"\n📋 Step: {step_name}")
            if not step_func():
                print(f"❌ Failed at step: {step_name}")
                return False
            time.sleep(1)
        
        print("\n🎉 Automatic publishing completed successfully!")
        return True

def main():
    """Main execution function"""
    print("🚀 RedoSan Authenticity - Simple Automatic GitHub Publisher")
    print("=" * 60)
    
    # Configuration
    repo_path = r"f:\RedoSan Authenticity"
    repo_name = "RedoSan-Authenticity"
    username = "Redo-San"
    
    # Get GitHub token from environment variable
    github_token = os.getenv("GITHUB_TOKEN")
    if not github_token:
        print("❌ GITHUB_TOKEN environment variable is not set.")
        print("📝 Please set it first:")
        print("   set GITHUB_TOKEN=your_github_token_here")
        print("📋 Get your token from: https://github.com/settings/tokens")
        return False
    
    # Create uploader instance
    uploader = SimpleGitHubUploader(repo_path, github_token, repo_name, username)
    
    # Perform full setup and publishing
    if uploader.full_setup_and_publish():
        print("\n🎉 SUCCESS! Project published to GitHub!")
        print(f"📋 Repository: https://github.com/{username}/{repo_name}")
        print(f"🏷️ Release: https://github.com/{username}/{repo_name}/releases")
        return True
    else:
        print("❌ Failed to publish project")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
