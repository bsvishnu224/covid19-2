const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

dbpath = path.join(__dirname, 'covid19IndiaPortal.db')

const app = express()
app.use(express.json())

let db

const initilizeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running')
    })
  } catch (e) {
    console.log(`DB Error:${e.message}`)
  }
}

initilizeDbAndServer()

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const checkUser = `SELECT * FROM user WHERE username='${username}';`
  const dbUser = await db.get(checkUser)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const checkpassword = await bcrypt.compare(password, dbUser.password)
    if (checkpassword) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'vishnu')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const convertingDbObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertingDbObjectForDistricts = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

const authonticationToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'vishnu', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

app.get('/states/', authonticationToken, async (request, response) => {
  const stateslist = `
        SELECT
            *
        FROM
            state
        ORDER BY
            state_id;
    
    `
  const stateArray = await db.all(stateslist)
  response.send(stateArray.map(eachArray => convertingDbObject(eachArray)))
})

app.get('/states/:stateId', authonticationToken, async (request, response) => {
  const {stateId} = request.params
  const stateDetail = `
    SELECT
        *
    FROM 
        state
    WHERE
        state_id=${stateId};


    `

  const state = await db.get(stateDetail)
  response.send(convertingDbObject(state))
})

app.post('/districts/', authonticationToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const addDetails = `
  INSERT INTO
    district(district_name,state_id,cases,cured,active,deaths)
  VALUES
    ("${districtName}",${stateId},${cases},${cured},${active},${deaths});
  
  `

  const details = await db.run(addDetails)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authonticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const districtDetails = `
  SELECT
    *
  FROM
    district
  WHERE
    district_id=${districtId}

    
  
  `
    const district = await db.get(districtDetails)
    response.send(convertingDbObjectForDistricts(district))
  },
)

app.delete(
  '/districts/:districtId/',
  authonticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const deletedistrict = `
  DELETE FROM 
    district
  WHERE
    district_id=${districtId}
  
  `
    await db.run(deletedistrict)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authonticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDetails = `
  UPDATE
    district
  SET
    district_name="${districtName}",

    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active};
    deaths=${deaths}
  WHERE
    district_id=${districtId}
  
  
  `
    await db.run(updateDetails)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authonticationToken,
  async (request, response) => {
    const {stateId} = request.params
    const getstats = `
  SELECT
    SUM(cases),
    SUM(cured),
    SUM(active),
    SUM(deaths)
  FROM
    district
  WHERE
    state_id=${stateId};
  
  `

    const stats = await db.get(getstats)

    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)

app.get(
  '/districts/:districtId/details/',
  authonticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const getdistrict = `
  SELECT 
    state_id 
  FROM 
    district
  WHERE 
    district_id=${districtId};
  `
    const districtresponse = await db.get(getdistrict)

    const getstateName = `
  SELECT
   state_name as stateName
  FROM
   state
  WHERE
   state_id=${districtresponse.state_id}
  
  `
    const getstate = await db.get(getstateName)
    response.send(getstate)
  },
)

module.exports = app
