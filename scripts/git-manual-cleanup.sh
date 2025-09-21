#!/bin/bash

# Git Manual Branch Cleanup Script
# Safe manual cleanup for specific branches with confirmation

set -e

echo "🧹 Git Manual Branch Cleanup"
echo "════════════════════════════"
echo ""

# Ensure we're in a git repository
if ! git status &>/dev/null; then
    echo "❌ Error: Not in a Git repository"
    exit 1
fi

# Current branch check
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "🔄 Switching to main branch (currently on $CURRENT_BRANCH)"
    git checkout main
fi

# Fetch latest changes
echo "📡 Fetching latest changes..."
git fetch --prune

echo ""
echo "📊 Current branch status:"
echo "────────────────────────────"
git branch -a

echo ""
echo "🔍 Analysis of chore/cleanup-foundation branch:"
echo "───────────────────────────────────────────────"

# Check if the branch exists
if git show-ref --verify --quiet refs/heads/chore/cleanup-foundation; then
    # Get branch info
    LAST_COMMIT=$(git log -1 --format="%h %s" chore/cleanup-foundation)
    LAST_DATE=$(git log -1 --format="%ai" chore/cleanup-foundation)
    COMMITS_BEHIND=$(git rev-list --count chore/cleanup-foundation..main)
    COMMITS_AHEAD=$(git rev-list --count main..chore/cleanup-foundation)
    
    echo "Last commit: $LAST_COMMIT"
    echo "Date: $LAST_DATE"
    echo "Commits behind main: $COMMITS_BEHIND"
    echo "Commits ahead of main: $COMMITS_AHEAD"
    
    # Check if merged
    if git merge-base --is-ancestor chore/cleanup-foundation main; then
        echo "Status: ✅ Merged into main"
        MERGE_STATUS="merged"
    else
        echo "Status: 🔀 Not merged into main"
        MERGE_STATUS="unmerged"
    fi
    
    echo ""
    echo "📋 Cleanup Recommendation:"
    echo "─────────────────────────────"
    
    if [ "$MERGE_STATUS" = "merged" ] || [ "$COMMITS_BEHIND" -gt 20 ]; then
        echo "✅ SAFE TO DELETE: This branch can be safely removed"
        echo ""
        echo "To delete this branch:"
        echo "  Local:  git branch -d chore/cleanup-foundation"
        echo "  Remote: git push origin --delete chore/cleanup-foundation"
        echo ""
        
        read -p "❓ Do you want to delete this branch now? (y/N): " -n 1 -r
        echo ""
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🗑️ Deleting branch: chore/cleanup-foundation"
            
            # Delete local branch
            if git branch -d chore/cleanup-foundation 2>/dev/null; then
                echo "✅ Local branch deleted"
            elif git branch -D chore/cleanup-foundation 2>/dev/null; then
                echo "✅ Local branch force deleted"
            else
                echo "ℹ️ Local branch not found or already deleted"
            fi
            
            # Delete remote branch
            if git push origin --delete chore/cleanup-foundation 2>/dev/null; then
                echo "✅ Remote branch deleted"
            else
                echo "ℹ️ Remote branch not found or already deleted"
            fi
            
            echo ""
            echo "✨ Branch cleanup completed!"
            
        else
            echo "❌ Branch cleanup cancelled"
        fi
        
    else
        echo "⚠️ REVIEW NEEDED: This branch has unmerged changes"
        echo ""
        echo "Before deleting, consider:"
        echo "  1. Review the changes: git diff main..chore/cleanup-foundation"
        echo "  2. Create a backup: git tag backup-cleanup-foundation chore/cleanup-foundation"
        echo "  3. Merge if needed: git merge chore/cleanup-foundation"
        echo ""
    fi
    
else
    echo "ℹ️ Branch chore/cleanup-foundation not found locally"
    
    # Check remote
    if git show-ref --verify --quiet refs/remotes/origin/chore/cleanup-foundation; then
        echo "📡 Remote branch origin/chore/cleanup-foundation exists"
        echo ""
        echo "To delete remote branch:"
        echo "  git push origin --delete chore/cleanup-foundation"
        echo ""
        
        read -p "❓ Do you want to delete the remote branch? (y/N): " -n 1 -r
        echo ""
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if git push origin --delete chore/cleanup-foundation; then
                echo "✅ Remote branch deleted"
            else
                echo "❌ Failed to delete remote branch"
            fi
        fi
    else
        echo "✅ No cleanup needed - branch not found"
    fi
fi

echo ""
echo "🏁 Final branch status:"
echo "──────────────────────"
git branch -a

echo ""
echo "✨ Branch cleanup script completed!"