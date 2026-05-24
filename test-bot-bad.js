function test() {
  console.log("this should be detected by console-log detector")
  const x = 1
  return x
}

function broken( {
  return true
}