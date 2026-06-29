
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to service account
const serviceAccountPath = join(__dirname, '../backend/cpanel/service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const email = 'abderuhamanelfekky@gmail.com';
const password = 'abdo12345';
const displayName = 'Abderuhaman Elfekky';

async function createTestUser() {
    try {
        // Check if user exists
        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
            console.log('User already exists:', userRecord.uid);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                // Create user
                userRecord = await admin.auth().createUser({
                    email,
                    password,
                    displayName,
                    emailVerified: true
                });
                console.log('Successfully created test user:', userRecord.uid);
            } else {
                throw error;
            }
        }

        // Ensure the user has a document in Firestore
        const db = admin.firestore();
        const userDocRef = db.collection('users').doc(userRecord.uid);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            const newUser = {
                name: displayName,
                username: email.split('@')[0],
                email: email,
                calorieGoal: 2000,
                proteinGoal: 150,
                carbsGoal: 200,
                fatGoal: 70,
                metabolism: 2200,
                experienceLevel: 'BEGINNER',
                onboardingCompleted: true, // Mark as completed for the test user
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
            await userDocRef.set(newUser);
            console.log('Created Firestore document for test user');
        } else {
            console.log('Firestore document already exists');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error creating test user:', error);
        process.exit(1);
    }
}

createTestUser();
