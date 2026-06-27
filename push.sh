#!/bin/bash
cd ~/Desktop/Antigravity/Neural-Mesh
git add .
git commit -m "Update UI, remove 3D mode, constellation templates"
git push origin main
git tag v1.1.9
git push origin v1.1.9
