npx nx build messenger-app --configuration=production

gcloud builds submit .  --config apps/messenger/messenger-app/cloudbuild.yaml   --substitutions=_IMAGE_NAME=europe-west1-docker.pkg.dev/gemini-power-test/registry/messenger-app --region=europe-west1

gcloud run deploy messenger-app --image europe-west1-docker.pkg.dev/gemini-power-test/registry/messenger-app  --project gemini-power-test  --region europe-west1  --allow-unauthenticated