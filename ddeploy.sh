#!/bin/bash

# Hanon Viewer Deployment Script
# Uploads all necessary files to hanon.artsmetrics.ai
# Phase 1: Everything except PDFs (fast deployment)
# Phase 2: PDFs (optional, slower)

echo "🎹 Deploying Hanon Viewer to hanon.artsmetrics.ai..."
echo "=================================================="

# FTP Configuration
FTP_SERVER="ftp.chipmiller.me"
FTP_USER="public_projects@chipmiller.me"
FTP_PASS="synxek-8xyhze-mAqror"
REMOTE_DIR="hanon"

# Function to upload a file
upload_file() {
    local local_file="$1"
    local remote_file="$2"
    
    if [ ! -f "$local_file" ]; then
        echo "❌ File not found: $local_file"
        return 1
    fi
    
    echo "📤 Uploading $local_file -> $remote_file..."
    
    curl -T "$local_file" \
         "ftp://$FTP_SERVER/$REMOTE_DIR/$remote_file" \
         --user "$FTP_USER:$FTP_PASS" \
         --create-dirs \
         --silent \
         --show-error
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully uploaded $remote_file"
    else
        echo "❌ Failed to upload $remote_file"
    fi
}

# Function to create remote directory
create_remote_dir() {
    local dir_name="$1"
    echo "📁 Creating remote directory: $dir_name"
    
    curl "ftp://$FTP_SERVER/$REMOTE_DIR/" \
         --user "$FTP_USER:$FTP_PASS" \
         --ftp-create-dirs \
         --quote "MKD $dir_name" \
         --silent 2>/dev/null || true
}

echo ""
echo "🚀 PHASE 1: Deploying core files (fast)..."
echo "============================================"

# Create remote directories
create_remote_dir "templates"
create_remote_dir "configs"
create_remote_dir "results"

# Upload core viewer files
echo ""
echo "📱 Uploading core viewer files..."
upload_file "hanon_viewer.html" "hanon_viewer.html"
upload_file "hanon_viewer.css" "hanon_viewer.css"
upload_file "hanon_viewer.js" "hanon_viewer.js"
upload_file "pdf_viewer.html" "pdf_viewer.html"
upload_file "pdf_viewer.css" "pdf_viewer.css"
upload_file "pdf_viewer.js" "pdf_viewer.js"
upload_file "index.php" "index.php"

# Upload backend files
echo ""
echo "🐍 Uploading backend files..."
upload_file "config_manager.py" "config_manager.py"
upload_file "process_pdfs.py" "process_pdfs.py"
upload_file "split_pdf.py" "split_pdf.py"
upload_file "merge_pdf.py" "merge_pdf.py"
upload_file "pdf_arranger.py" "pdf_arranger.py"
upload_file "requirements.txt" "requirements.txt"

# Upload template files
echo ""
echo "📄 Uploading template files..."
for template in templates/*.html; do
    if [ -f "$template" ]; then
        filename=$(basename "$template")
        upload_file "$template" "templates/$filename"
    fi
done

# Upload config files
echo ""
echo "⚙️ Uploading config files..."
upload_file "pdf_processing_config.json" "pdf_processing_config.json"
for config in configs/*.json; do
    if [ -f "$config" ]; then
        filename=$(basename "$config")
        upload_file "$config" "configs/$filename"
    fi
done

# Upload other important files
echo ""
echo "📋 Uploading documentation and other files..."
upload_file "README.md" "README.md"
upload_file "COMPREHENSIVE_README.md" "COMPREHENSIVE_README.md"
upload_file "LIBRARY_README.md" "LIBRARY_README.md"
upload_file "MULTI_PAGE_LAYOUT_GUIDE.md" "MULTI_PAGE_LAYOUT_GUIDE.md"

echo ""
echo "✅ PHASE 1 COMPLETE: Core files deployed!"
echo "=========================================="
echo ""
echo "🎯 Your Hanon viewer should now be accessible at:"
echo "   https://hanon.artsmetrics.ai/"
echo ""

# Ask user if they want to deploy PDFs
read -p "📚 Deploy PDF files now? This will take longer due to file sizes. (y/N): " deploy_pdfs

if [[ $deploy_pdfs =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 PHASE 2: Deploying PDF files (slower)..."
    echo "==========================================="
    
    # Upload PDF files from results directory
    echo ""
    echo "📚 Uploading PDF files..."
    pdf_count=0
    for pdf in results/*.pdf; do
        if [ -f "$pdf" ]; then
            filename=$(basename "$pdf")
            upload_file "$pdf" "results/$filename"
            pdf_count=$((pdf_count + 1))
        fi
    done
    
    echo ""
    echo "✅ PHASE 2 COMPLETE: $pdf_count PDF files deployed!"
    echo "=================================================="
else
    echo ""
    echo "⏭️  PDF deployment skipped."
    echo "   Run this script again and choose 'y' to deploy PDFs later."
fi

echo ""
echo "🎉 Deployment Summary:"
echo "====================="
echo "✅ Core application files deployed"
echo "✅ Backend Python files deployed"
echo "✅ Templates and configs deployed"
echo "✅ Documentation deployed"
if [[ $deploy_pdfs =~ ^[Yy]$ ]]; then
    echo "✅ PDF files deployed"
else
    echo "⏭️  PDF files skipped (deploy later if needed)"
fi
echo ""
echo "🌐 Your Hanon Viewer is ready at: https://hanon.artsmetrics.ai/"
echo "�� Happy practicing!" 