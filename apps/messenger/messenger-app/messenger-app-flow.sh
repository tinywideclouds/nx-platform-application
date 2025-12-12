# 1. Build locally (Uses your existing node_modules + Nx Cache)
# This takes seconds if you've built recently.
npx nx build messenger-app --configuration=production

# 3. Push
gcloud builds submit .  --config apps/messenger/messenger-app/cloudbuild.yaml   --substitutions=_IMAGE_NAME=europe-west1-docker.pkg.dev/gemini-power-test/registry/messenger-app --region=europe-west1


# # 4. Deploy (First run with placeholder URLs to get the Origin)
# gcloud run deploy messenger-app \
#   --image gcr.io/gemini-power-test/messenger-app \
#   --project gemini-power-test \
#   --region us-central1 \
#   --allow-unauthenticated \
#   --set-env-vars="NGINX_LOG_LEVEL=debug" \
#   --set-env-vars="IDENTITY_SERVICE_URL=http://localhost" \
#   --set-env-vars="KEY_SERVICE_URL=http://localhost" \
#   --set-env-vars="ROUTING_SERVICE_URL=http://localhost" \
#   --set-env-vars="NOTIFICATION_SERVICE_URL=http://localhost" \
#   --set-env-vars="WSS_URL=http://localhost"

# if env vars already set
gcloud run deploy messenger-app --image europe-west1-docker.pkg.dev/gemini-power-test/registry/messenger-app  --project gemini-power-test  --region europe-west1  --allow-unauthenticated  
