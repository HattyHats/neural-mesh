#!/bin/bash
cd ~/Desktop/Antigravity/Neural-Mesh
git add .
git commit -m "Isolate Mac build"
git push origin main
git tag v1.0.4
git push origin v1.0.4
