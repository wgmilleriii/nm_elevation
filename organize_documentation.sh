#!/bin/bash

# Documentation Organization Script
# Following .cursorrules: "keep documentation files .md organized and named and cross-referenced and updated regularly"
# "strive for no more than 20 files per folder"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="docs_organization.log"

echo "[$TIMESTAMP] Starting documentation organization..." >> $LOG_FILE

# Create organized docs structure
mkdir -p docs/{setup,api,guides,troubleshooting,development}

# Count current .md files
MD_COUNT=$(find . -name "*.md" | wc -l)
echo "[$TIMESTAMP] Found $MD_COUNT .md files to organize" >> $LOG_FILE

# Organize existing .md files
organize_file() {
    local file=$1
    local category=$2
    local new_name=$3
    
    if [ -f "$file" ]; then
        if [ -n "$new_name" ]; then
            mv "$file" "docs/$category/$new_name"
            echo "[$TIMESTAMP] Moved $file to docs/$category/$new_name" >> $LOG_FILE
        else
            mv "$file" "docs/$category/"
            echo "[$TIMESTAMP] Moved $file to docs/$category/" >> $LOG_FILE
        fi
    fi
}

# Setup documentation
organize_file "README.md" "setup" "00_README.md"
organize_file "PI_SETUP.md" "setup" "01_PI_SETUP.md"
organize_file "PI_SETUP_FILES.md" "setup" "02_PI_SETUP_FILES.md"
organize_file "instructions-pi.md" "setup" "03_instructions_pi.md"
organize_file "filezilla_guide.md" "setup" "04_filezilla_guide.md"

# API and development documentation
organize_file "WINDOW.md" "development" "01_WINDOW.md"
organize_file "face.md" "development" "02_face.md"
organize_file "git.md" "development" "03_git.md"
organize_file "sandia.md" "development" "04_sandia.md"
organize_file "index.md" "development" "05_index.md"

# Guides (leave in docs folder)
if [ -d "docs" ]; then
    find docs -name "*.md" -type f | head -20 > temp_docs_list.txt
    DOCS_COUNT=$(cat temp_docs_list.txt | wc -l)
    echo "[$TIMESTAMP] Found $DOCS_COUNT existing docs files" >> $LOG_FILE
    rm temp_docs_list.txt
fi

# Create cross-reference index
cat > docs/00_INDEX.md << 'EOF'
# Documentation Index

## Setup Documentation
- [README](setup/00_README.md) - Main project documentation
- [PI Setup](setup/01_PI_SETUP.md) - Raspberry Pi setup instructions
- [PI Setup Files](setup/02_PI_SETUP_FILES.md) - Required files for Pi
- [Pi Instructions](setup/03_instructions_pi.md) - Pi-specific commands
- [Filezilla Guide](setup/04_filezilla_guide.md) - FTP setup guide

## Development Documentation
- [Window System](development/01_WINDOW.md) - Window management
- [Face Recognition](development/02_face.md) - Face detection features
- [Git Workflow](development/03_git.md) - Version control process
- [Sandia Data](development/04_sandia.md) - Sandia mountain data
- [Index System](development/05_index.md) - Indexing and search

## API Documentation
- [Database Stats](api/) - Database statistics endpoints
- [Elevation Data](api/) - Elevation data APIs

## Guides
- [Automation Summary](guides/) - System automation guide
- [Dummies Guide](guides/) - Beginner's guide
- [Sync Setup](guides/) - Data synchronization setup

## Troubleshooting
- [Lock Sync Changes](troubleshooting/) - Sync lock issues
- [Summary Report](troubleshooting/) - System status reports

Last Updated: $(date)
EOF

# Create category READMEs
cat > docs/setup/README.md << 'EOF'
# Setup Documentation

This folder contains all setup and installation documentation.

## Files
- 00_README.md - Main project documentation
- 01_PI_SETUP.md - Raspberry Pi setup
- 02_PI_SETUP_FILES.md - Required Pi files
- 03_instructions_pi.md - Pi commands
- 04_filezilla_guide.md - FTP setup
EOF

cat > docs/development/README.md << 'EOF'
# Development Documentation

This folder contains development-related documentation.

## Files
- 01_WINDOW.md - Window system
- 02_face.md - Face recognition
- 03_git.md - Git workflow
- 04_sandia.md - Sandia data
- 05_index.md - Index system
EOF

# Check folder limits
for folder in docs/*; do
    if [ -d "$folder" ]; then
        count=$(find "$folder" -maxdepth 1 -name "*.md" | wc -l)
        folder_name=$(basename "$folder")
        echo "[$TIMESTAMP] $folder_name: $count .md files" >> $LOG_FILE
        if [ $count -gt 20 ]; then
            echo "[$TIMESTAMP] WARNING: $folder_name has $count files (>20 limit)" >> $LOG_FILE
        fi
    fi
done

echo "[$TIMESTAMP] Documentation organization completed" >> $LOG_FILE
echo "Documentation organized. Check docs/ folder structure"
echo "Log: $LOG_FILE"