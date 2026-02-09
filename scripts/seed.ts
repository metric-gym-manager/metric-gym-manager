import { Pool } from 'pg'
import { hashPassword } from '../src/features/auth/services/password.service'

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gym_management_dev',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
})

async function seed() {
  const client = await pool.connect()

  try {
    console.log('🌱 Starting database seed...')

    // Create a test gym
    console.log('Creating test gym...')
    const gymResult = await client.query(
      `INSERT INTO gyms (name, slug, email, phone, timezone, currency)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      ['FitLife Gym', 'fitlife-gym', 'contact@fitlife.com', '+1234567890', 'America/New_York', 'USD']
    )
    const gymId = gymResult.rows[0].id
    console.log(`✓ Created gym with ID: ${gymId}`)

    // Create a gym owner user
    console.log('Creating gym owner...')
    const hashedPassword = await hashPassword('Password123')
    const userResult = await client.query(
      `INSERT INTO users (gym_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [gymId, 'owner@fitlife.com', hashedPassword, 'John', 'Smith', 'gym_owner']
    )
    const userId = userResult.rows[0].id
    console.log(`✓ Created gym owner with ID: ${userId}`)
    console.log(`  Email: owner@fitlife.com`)
    console.log(`  Password: Password123`)

    // Create sample membership plans
    console.log('Creating membership plans...')
    const plans = [
      {
        name: 'Monthly Basic',
        description: 'Access during business hours',
        planType: 'monthly',
        priceAmount: 49.99,
        billingFrequency: 'monthly',
        trialDays: 7,
      },
      {
        name: 'Annual Premium',
        description: '24/7 access + 2 months free',
        planType: 'annual',
        priceAmount: 499.99,
        billingFrequency: 'annual',
        trialDays: 14,
      },
      {
        name: 'Drop-In Pass',
        description: 'Single visit pass',
        planType: 'drop_in',
        priceAmount: 15.00,
        billingFrequency: 'one_time',
        trialDays: 0,
      },
    ]

    for (const plan of plans) {
      await client.query(
        `INSERT INTO membership_plans (
          gym_id, name, description, plan_type, price_amount,
          billing_frequency, trial_days
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          gymId,
          plan.name,
          plan.description,
          plan.planType,
          plan.priceAmount,
          plan.billingFrequency,
          plan.trialDays,
        ]
      )
      console.log(`✓ Created plan: ${plan.name}`)
    }

    console.log('\n✅ Seed completed successfully!')
    console.log('\n📋 Login credentials:')
    console.log(`   Gym ID: ${gymId}`)
    console.log(`   Email: owner@fitlife.com`)
    console.log(`   Password: Password123`)
  } catch (error) {
    console.error('❌ Seed failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
