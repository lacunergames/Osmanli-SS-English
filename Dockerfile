FROM node:20-alpine

# Hugging Face Spaces requires containers to run as a non-root user (uid 1000)
# The 'node' user built into the alpine image has uid 1000
WORKDIR /app
RUN chown node:node /app

# Switch to non-root user for security and HF compliance
USER node

# 1. Dependency Layer (Cache-friendly)
COPY --chown=node:node package*.json ./
RUN npm install

# 2. Application Code Layer
COPY --chown=node:node . .

# 3. Build-time Secrets Injection
# Hugging Face automatically passes Secrets as build arguments
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Map ARG to ENV so Vite can bake them into the static files during build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# 4. Build the application
RUN npm run build

# 5. Runtime Configuration
ENV PORT=7860
ENV NODE_ENV=production
EXPOSE 7860

CMD ["npm", "start"]
