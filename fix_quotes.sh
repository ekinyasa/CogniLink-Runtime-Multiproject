#!/bin/bash
sed -i '' "s/            <div style=\"display: flex; align-items: center; gap: 0.5rem;\">/            '<div style=\"display: flex; align-items: center; gap: 0.5rem;\">' +/g" functions/_shared/admin-renderer.js
sed -i '' "s/            <\/div>/            '<\/div>' +/g" functions/_shared/admin-renderer.js
