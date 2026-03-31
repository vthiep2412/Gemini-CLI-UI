import re

with open('src/components/MainContent.jsx', 'r') as f:
    content = f.read()

# Oh I see, earlier I replaced `<IDETab selectedProject={selectedProject} isMobile={isMobile} />`
# with `<IDETab selectedProject={selectedProject} isMobile={isMobile} openFileFromChat={openFileFromChat} />`
# But if it was `const [openFileFromChat, ...]` it should work. Let me check the file content.
