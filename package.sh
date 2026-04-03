#!/bin/bash
# A simple script to package the extension for end users

echo "Packaging NCKU Moodle Keeper..."
zip ncku-moodle-keeper.zip manifest.json captcha.js session_keeper.js templates.json templates2.json README.md
echo "Done."
