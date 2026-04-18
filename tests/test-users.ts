export interface TestUser {
  email:    string
  password: string
  nickname: string
  venmo:    string | null
}

export const TEST_PASSWORD = 'Vegdog123!'

export const TEST_USERS: TestUser[] = [
  { email: 'test__corgi_driver@gmail.com',      nickname: 'test__corgi_driver',    venmo: 'test--corgi-driver'      },
  { email: 'test__husky_pilot@gmail.com',        nickname: 'test__husky_pilot',     venmo: 'test--husky-pilot'       },
  { email: 'test__shiba_lawyer@gmail.com',       nickname: 'test__柴犬弁護士',        venmo: null                      },
  { email: 'test__panda_chef@gmail.com',         nickname: 'test__熊猫厨师',          venmo: 'test--panda-chef'        },
  { email: 'test__golden_teacher@gmail.com',     nickname: 'test__golden_teacher',  venmo: null                      },
  { email: 'test__kitty_nurse@gmail.com',        nickname: 'test__猫咪护士',          venmo: 'test--kitty-nurse'       },
  { email: 'test__rabbit_coder@gmail.com',       nickname: 'test__rabbit_coder',    venmo: 'test--rabbit-coder'      },
  { email: 'test__tanuki_banker@gmail.com',      nickname: 'test__狸猫银行家',        venmo: null                      },
  { email: 'test__fox_designer@gmail.com',       nickname: 'test__fox_designer',    venmo: 'test--fox-designer'      },
  { email: 'test__duck_engineer@gmail.com',      nickname: 'test__duck_engineer',   venmo: null                      },
  { email: 'test__penguin_doctor@gmail.com',     nickname: 'test__企鹅医生',          venmo: 'test--penguin-doctor'    },
  { email: 'test__otter_artist@gmail.com',       nickname: 'test__otter_artist',    venmo: 'test--otter-artist'      },
  { email: 'test__wolf_musician@gmail.com',      nickname: 'test__wolf_musician',   venmo: null                      },
  { email: 'test__hamster_chef@gmail.com',       nickname: 'test__ハムスター料理人',   venmo: 'test--hamster-chef'      },
  { email: 'test__bear_accountant@gmail.com',    nickname: 'test__熊会计',            venmo: null                      },
  { email: 'test__deer_developer@gmail.com',     nickname: 'test__deer_developer',  venmo: 'test--deer-developer'    },
  { email: 'test__cat_lawyer@gmail.com',         nickname: 'test__猫律师',            venmo: null                      },
  { email: 'test__horse_trainer@gmail.com',      nickname: 'test__horse_trainer',   venmo: 'test--horse-trainer'     },
  { email: 'test__seal_teacher@gmail.com',       nickname: 'test__アザラシ先生',       venmo: null                      },
  { email: 'test__crow_detective@gmail.com',     nickname: 'test__乌鸦侦探',          venmo: 'test--crow-detective'    },
].map(u => ({ ...u, password: TEST_PASSWORD }))
