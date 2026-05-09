use std::env;
use std::time::Instant;
use std::fs;
use std::io::{self, Read};

fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 2 {
        println!("RedoSan Backend v0.1.0");
        return;
    }
    
    match args[1].as_str() {
        "progress" => {
            if args.len() < 4 {
                println!("Usage: progress <current> <total>");
                return;
            }
            let current: f32 = args[2].parse().unwrap_or(0.0);
            let total: f32 = args[3].parse().unwrap_or(100.0);
            let percentage = if total > 0.0 { (current / total) * 100.0 } else { 0.0 };
            let filled = (percentage / 5.0) as usize;
            let bar = format!("{}{}", "=".repeat(filled), "-".repeat(20 - filled));
            println!("[{}] {}%", bar, percentage as i32);
        }
        "hash" => {
            if args.len() < 3 {
                println!("Usage: hash ");
                return;
            }
            let filename = &args[2];
            let start = Instant::now();
            match fs::read(filename) {
                Ok(data) => {
                    use std::collections::hash_map::DefaultHasher;
                    use std::hash::{Hash, Hasher};
                    let mut hasher = DefaultHasher::new();
                    data.hash(&mut hasher);
                    println!("Hash: {:016x}", hasher.finish());
                    println!("Time: {:?}", start.elapsed());
                }
                Err(e) => {
                    println!("Error reading file: {}", e);
                }
            }
        }
        "size" => {
            if args.len() < 3 {
                println!("Usage: size ");
                return;
            }
            let filename = &args[2];
            match fs::metadata(filename) {
                Ok(meta) => {
                    println!("Size: {} bytes", meta.len());
                }
                Err(e) => {
                    println!("Error: {}", e);
                }
            }
        }
        _ => {
            println!("Unknown command: {}", args[1]);
        }
    }
}