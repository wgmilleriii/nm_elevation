#!/bin/bash

echo "🗺️  Elevation Data Collection Status"
echo "===================================="
echo ""

# Check Colorado databases
echo "🏔️  COLORADO DATABASES:"
if ls grid_databases/colorado_*.db 1> /dev/null 2>&1; then
    for db in grid_databases/colorado_*.db; do
        if [ -f "$db" ]; then
            points=$(sqlite3 "$db" "SELECT COUNT(*) FROM points;" 2>/dev/null || echo "0")
            basename=$(basename "$db" .db)
            printf "   %-20s: %6s points\n" "$basename" "$points"
        fi
    done
    
    total_co=$(find grid_databases -name "colorado_*.db" -exec sqlite3 {} "SELECT COUNT(*) FROM points;" \; 2>/dev/null | paste -sd+ | bc 2>/dev/null || echo "0")
    echo "   ----------------------------------------"
    printf "   %-20s: %6s points\n" "COLORADO TOTAL" "$total_co"
else
    echo "   No Colorado databases found"
fi

echo ""

# Check New Mexico databases  
echo "🌵 NEW MEXICO DATABASES:"
if ls grid_databases/mountains_*.db 1> /dev/null 2>&1; then
    count=0
    total_points=0
    for db in grid_databases/mountains_*.db; do
        if [ -f "$db" ]; then
            points=$(sqlite3 "$db" "SELECT COUNT(*) FROM points;" 2>/dev/null || echo "0")
            total_points=$((total_points + points))
            count=$((count + 1))
            if [ $count -le 5 ]; then
                basename=$(basename "$db" .db)
                printf "   %-20s: %6s points\n" "$basename" "$points"
            fi
        fi
    done
    
    if [ $count -gt 5 ]; then
        echo "   ... and $((count - 5)) more databases"
    fi
    
    echo "   ----------------------------------------"
    printf "   %-20s: %6s points\n" "NEW MEXICO TOTAL" "$total_points"
else
    echo "   No New Mexico databases found"
fi

echo ""
echo "🚀 COLLECTION COMMANDS:"
echo "   Colorado:    ./collect_colorado_points.sh"
echo "   New Mexico:  node collect_sparse_points.js --state=new-mexico"
echo "   Status:      ./check_collection_status.sh" 