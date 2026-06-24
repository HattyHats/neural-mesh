#!/bin/bash
cd ~/Desktop/Antigravity/Neural-Mesh
git add .
git commit -m "v1.1.8: The Interactive Brain Update"
git push origin main
git tag v1.1.8
git push origin v1.1.8
echo "Successfully pushed and tagged v1.1.8! GitHub Actions is now building the new release."
