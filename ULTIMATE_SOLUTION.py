#!/usr/bin/env python3
"""
🚀 Ultimate GitHub Publishing Solution
Uses GitHub API directly to upload files without Git
"""

import os
import json
import urllib.request
import urllib.parse
import base64
import mimetypes
from pathlib import Path

class UltimateGitHubUploader:
    def __init__(self, repo_path, github_token, repo_name, username="Redo-San"):
        self.repo_path = Path(repo_path)
        self.github_token = github_token
        self.repo_name = repo_name
        self.username = username
        self.api_url = f"https://api.github.com/repos/{username}/{repo_name}"
        
    def create_repository_if_not_exists(self):
        """Create repository using GitHub API"""
        print("📋 Checking if repository exists...")
        
        try:
            url = f"https://api.github.com/repos/{self.username}/{self.repo_name}"
            req = urllib.request.Request(url)
            req.add_header('Authorization', f'token {self.github_token}')
            req.add_header('User-Agent', 'RedoSan-UltimateUploader')
            
            with urllib.request.urlopen(req) as response:
                if response.status == 200:
                    print("✅ Repository already exists")
                    return True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print("📝 Creating new repository...")
                
                create_data = {
                    "name": self.repo_name,
                    "description": "Steganography + OpenTimestamps + C2PA - Advanced Data Authenticity Tool",
                    "private": False,
                    "auto_init": False  # We'll add files manually
                }
                
                url = "https://api.github.com/user/repos"
                req = urllib.request.Request(url)
                req.add_header('Authorization', f'token {self.github_token}')
                req.add_header('User-Agent', 'RedoSan-UltimateUploader')
                req.add_header('Content-Type', 'application/json')
                
                data = json.dumps(create_data).encode('utf-8')
                
                try:
                    with urllib.request.urlopen(req, data) as response:
                        if response.status == 201:
                            print("✅ Repository created successfully")
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
    
    def get_file_content_base64(self, file_path):
        """Get file content as base64"""
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
                return base64.b64encode(content).decode('utf-8')
        except Exception as e:
            print(f"❌ Error reading file {file_path}: {e}")
            return None
    
    def upload_file(self, file_path, commit_message="Add file"):
        """Upload a single file to GitHub"""
        relative_path = str(file_path.relative_to(self.repo_path)).replace('\\', '/')
        
        # Skip git files and temporary files
        if '.git' in relative_path or relative_path.startswith('.') and relative_path != '.gitignore':
            return True
        
        content = self.get_file_content_base64(file_path)
        if content is None:
            return False
        
        # Determine file type
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if mime_type is None:
            mime_type = 'text/plain'
        
        file_data = {
            "message": f"{commit_message}: {relative_path}",
            "content": content
        }
        
        url = f"{self.api_url}/contents/{urllib.parse.quote(relative_path)}"
        req = urllib.request.Request(url)
        req.add_header('Authorization', f'token {self.github_token}')
        req.add_header('User-Agent', 'RedoSan-UltimateUploader')
        req.add_header('Content-Type', 'application/json')
        
        data = json.dumps(file_data).encode('utf-8')
        
        try:
            with urllib.request.urlopen(req, data) as response:
                if response.status in [201, 200]:
                    print(f"✅ Uploaded: {relative_path}")
                    return True
                else:
                    print(f"❌ Failed to upload {relative_path}: {response.status}")
                    return False
        except urllib.error.HTTPError as e:
            if e.code == 422:
                # File already exists, update it
                try:
                    # Get current file SHA
                    get_req = urllib.request.Request(url)
                    get_req.add_header('Authorization', f'token {self.github_token}')
                    get_req.add_header('User-Agent', 'RedoSan-UltimateUploader')
                    
                    with urllib.request.urlopen(get_req) as get_response:
                        file_info = json.loads(get_response.read().decode('utf-8'))
                        file_data["sha"] = file_info["sha"]
                        
                        # Update the file
                        data = json.dumps(file_data).encode('utf-8')
                        
                        with urllib.request.urlopen(req, data) as response:
                            if response.status == 200:
                                print(f"✅ Updated: {relative_path}")
                                return True
                            else:
                                print(f"❌ Failed to update {relative_path}: {response.status}")
                                return False
                except Exception as e:
                    print(f"❌ Error updating {relative_path}: {e}")
                    return False
            else:
                print(f"❌ Error uploading {relative_path}: {e}")
                return False
        except Exception as e:
            print(f"❌ Error uploading {relative_path}: {e}")
            return False
    
    def upload_all_files(self):
        """Upload all files in the repository"""
        print("📤 Uploading all files...")
        
        # Get all files
        all_files = []
        for file_path in self.repo_path.rglob('*'):
            if file_path.is_file():
                all_files.append(file_path)
        
        print(f"📋 Found {len(all_files)} files to upload")
        
        # Upload files in batches
        success_count = 0
        for i, file_path in enumerate(all_files, 1):
            print(f"📤 [{i}/{len(all_files)}] Uploading: {file_path.name}")
            
            if self.upload_file(file_path, f"🚀 Add {file_path.name}"):
                success_count += 1
            
            # Small delay to avoid rate limiting
            if i % 10 == 0:
                print(f"⏸️ Pausing to avoid rate limiting...")
                import time
                time.sleep(1)
        
        print(f"✅ Successfully uploaded {success_count}/{len(all_files)} files")
        return success_count > 0
    
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
        req.add_header('User-Agent', 'RedoSan-UltimateUploader')
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
        print("🚀 Starting ULTIMATE automatic GitHub publishing...")
        print("=" * 60)
        
        steps = [
            ("Create Repository", self.create_repository_if_not_exists),
            ("Upload All Files", self.upload_all_files),
            ("Create Release", self.create_release),
        ]
        
        for step_name, step_func in steps:
            print(f"\n📋 Step: {step_name}")
            if not step_func():
                print(f"❌ Failed at step: {step_name}")
                return False
        
        print("\n🎉 ULTIMATE publishing completed successfully!")
        return True

def main():
    """Main execution function"""
    print("🚀 RedoSan Authenticity - ULTIMATE GitHub Publisher")
    print("=" * 60)
    print("🔥 This solution bypasses Git completely and uses GitHub API directly!")
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
    uploader = UltimateGitHubUploader(repo_path, github_token, repo_name, username)
    
    # Perform full setup and publishing
    if uploader.full_setup_and_publish():
        print("\n🎉 SUCCESS! Project published to GitHub!")
        print(f"📋 Repository: https://github.com/{username}/{repo_name}")
        print(f"🏷️ Release: https://github.com/{username}/{repo_name}/releases")
        print("\n🔥 This bypassed Git completely and used GitHub API directly!")
        return True
    else:
        print("❌ Failed to publish project")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
