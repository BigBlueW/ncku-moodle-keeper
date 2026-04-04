#!/bin/bash
# A simple script to package the extension for end users

echo "Packaging NCKU Moodle Keeper..."
rm -f ncku-moodle-keeper.zip
cd src && zip -r ../ncku-moodle-keeper.zip .
cd ..
echo "Done."
