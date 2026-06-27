#!/bin/bash
cd ~/Desktop/Antigravity/Neural-Mesh
git add .
git commit -m "Update UI, remove 3D mode, fix physics bug"
git push origin main
git tag v1.1.10
git push origin v1.1.10
