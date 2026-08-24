import fs from 'fs';
let code = fs.readFileSync('functions/_shared/hub-renderer.js', 'utf8');

const bad404End = `            }
          });
        }
        });
      });
    });
  </script>
</body>
</html>\`;
  }`;

const good404End = `            }
          });
        }
      });
    });
  </script>
</body>
</html>\`;
  }`;

if (code.includes(bad404End)) {
  console.log("Fixing 404 block...");
  code = code.replace(bad404End, good404End);
  fs.writeFileSync('functions/_shared/hub-renderer.js', code);
} else {
  console.log("Could not find bad 404 ending.");
}
