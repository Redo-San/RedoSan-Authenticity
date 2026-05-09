#!/usr/bin/env python3
"""
GitHub Publishing Script for RedoSan-Authenticity
Automated script to publish the project to GitHub
"""

import os
import subprocess
import sys
from pathlib import Path

def run_command(command, description=""):
    """Run a command and handle errors"""
    print(f"🔧 {description}")
    print(f"   Command: {command}")
    
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, encoding='utf-8')
        if result.returncode == 0:
            print(f"   ✅ Success: {result.stdout.strip()}")
            return True
        else:
            print(f"   ❌ Error: {result.stderr.strip()}")
            return False
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False

def check_github_cli():
    """Check if GitHub CLI is installed"""
    print("🔍 Checking GitHub CLI...")
    return run_command("gh --version", "Check GitHub CLI version")

def check_git():
    """Check if Git is installed"""
    print("🔍 Checking Git...")
    return run_command("git --version", "Check Git version")

def setup_repository():
    """Setup Git repository"""
    print("\n📁 Setting up repository...")
    
    # Initialize Git if not already done
    if not Path(".git").exists():
        if not run_command("git init", "Initialize Git repository"):
            return False
    
    # Add all files
    if not run_command("git add .", "Add all files"):
        return False
    
    # Initial commit
    if not run_command('git commit -m "Initial commit - Beta Release v1.0.0"', "Initial commit"):
        return False
    
    # Set main branch
    if not run_command("git branch -M main", "Set main branch"):
        return False
    
    return True

def create_github_repo():
    """Create GitHub repository"""
    print("\n🌟 Creating GitHub repository...")
    
    # Check if repository exists
    if run_command("gh repo view Redo-San/RedoSan-Authenticity", "Check if repository exists"):
        print("   📋 Repository already exists")
        return True
    
    # Create new repository
    cmd = 'gh repo create RedoSan-Authenticity --public --description "Steganography + OpenTimestamps + C2PA"'
    return run_command(cmd, "Create GitHub repository")

def setup_remote():
    """Setup remote origin"""
    print("\n🔗 Setting up remote...")
    
    # Remove existing remote if exists
    run_command("git remote remove origin", "Remove existing remote")
    
    # Add new remote
    cmd = "git remote add origin https://github.com/Redo-San/RedoSan-Authenticity.git"
    return run_command(cmd, "Add remote origin")

def push_to_github():
    """Push to GitHub"""
    print("\n🚀 Pushing to GitHub...")
    
    # Push to main branch
    cmd = "git push -u origin main"
    return run_command(cmd, "Push to GitHub")

def create_release():
    """Create GitHub release"""
    print("\n🏷️ Creating release...")
    
    # Create tag
    if not run_command('git tag -a v1.0.0-beta -m "Beta Release v1.0.0"', "Create tag"):
        return False
    
    # Push tag
    if not run_command("git push origin v1.0.0-beta", "Push tag"):
        return False
    
    # Create release
    cmd = ('gh release create v1.0.0-beta --title "Beta Release v1.0.0" '
            '--notes "Beta Release of RedoSan Authenticity with enhanced data persistence system."')
    return run_command(cmd, "Create release")

def create_download_files():
    """Create download files"""
    print("\n📦 Creating download files...")
    
    # Create ZIP file
    cmd = 'git archive --format zip --output RedoSan_Authenticity_v1.0.0-beta.zip main'
    if not run_command(cmd, "Create ZIP file"):
        return False
    
    # Create TAR.GZ file
    cmd = 'git archive --format tar.gz --output RedoSan_Authenticity_v1.0.0-beta.tar.gz main'
    if not run_command(cmd, "Create TAR.GZ file"):
        return False
    
    return True

def upload_release_assets():
    """Upload release assets"""
    print("\n📤 Uploading release assets...")
    
    # Upload ZIP file
    cmd = 'gh release upload v1.0.0-beta RedoSan_Authenticity_v1.0.0-beta.zip'
    run_command(cmd, "Upload ZIP file")
    
    # Upload TAR.GZ file
    cmd = 'gh release upload v1.0.0-beta RedoSan_Authenticity_v1.0.0-beta.tar.gz'
    run_command(cmd, "Upload TAR.GZ file")
    
    return True

def main():
    """Main function"""
    print("🚀 RedoSan Authenticity - GitHub Publishing Script")
    print("=" * 50)
    
    # Change to project directory
    os.chdir("f:\\RedoSan Authenticity")
    print(f"📁 Working directory: {os.getcwd()}")
    
    # Check prerequisites
    if not check_git():
        print("❌ Git is not installed. Please install Git first.")
        return False
    
    if not check_github_cli():
        print("❌ GitHub CLI is not installed. Please install GitHub CLI first.")
        return False
    
    # Check if user is authenticated
    if not run_command("gh auth status", "Check GitHub authentication"):
        print("❌ Not authenticated with GitHub. Please run 'gh auth login' first.")
        return False
    
    # Setup repository
    if not setup_repository():
        print("❌ Failed to setup repository.")
        return False
    
    # Create GitHub repository
    if not create_github_repo():
        print("❌ Failed to create GitHub repository.")
        return False
    
    # Setup remote
    if not setup_remote():
        print("❌ Failed to setup remote.")
        return False
    
    # Push to GitHub
    if not push_to_github():
        print("❌ Failed to push to GitHub.")
        return False
    
    # Create download files
    if not create_download_files():
        print("❌ Failed to create download files.")
        return False
    
    # Create release
    if not create_release():
        print("❌ Failed to create release.")
        return False
    
    # Upload release assets
    if not upload_release_assets():
        print("❌ Failed to upload release assets.")
        return False
    
    print("\n🎉 SUCCESS! Project published to GitHub!")
    print("📋 Repository: https://github.com/Redo-San/RedoSan-Authenticity")
    print("🏷️ Release: https://github.com/Redo-San/RedoSan-Authenticity/releases/tag/v1.0.0-beta")
    print("📦 Download: https://github.com/Redo-San/RedoSan-Authenticity/releases")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
